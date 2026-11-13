// The HTML shell every email is wrapped in, and the functions that send it.
// Server-only: never import from a client component.

import {
  EMAIL_NOT_CONFIGURED,
  emailTransport,
  type OutgoingEmail,
  type SendOneResult,
  type SendResult,
} from "@/server/providers/email";

/**
 * The From header. Set EMAIL_FROM to an address on a domain your email
 * provider has verified, e.g. `My Hackathon <noreply@mydomain.org>`.
 * The fallback is a placeholder that no provider will accept.
 */
export const DEFAULT_FROM = process.env.EMAIL_FROM?.trim() || "Dua <noreply@example.org>";

/**
 * Base URL for anything that has to resolve from inside someone's inbox:
 * the logo and the unsubscribe and edit links.
 *
 * Set NEXT_PUBLIC_SITE_URL to the public address of your deployment. If it's
 * unset or points at localhost, links in email only work on the machine that
 * sent them — fine for local testing, broken for a real send.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return configured || "http://localhost:3000";
}

// ── sanitizing ───────────────────────────────────────────────────
//
// The composer is a constrained WYSIWYG that only ever produces these tags,
// but the HTML arrives from the browser and is mailed to every registrant, so
// it's re-checked server-side. An admin account is trusted-ish; this exists so
// a compromised one can't mail a <script>-laden or link-spoofed blast, and so
// pasted Word/Google-Docs markup can't wreck the layout.

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "a", "ul", "ol", "li", "h2", "h3", "blockquote", "hr", "img",
]);

/** Void tags must not be given a closing partner. */
const VOID_TAGS = new Set(["br", "hr", "img"]);

/** Tags whose *content* goes too, not just the tag. */
const STRIP_WITH_CONTENT = /<(script|style|iframe|object|embed|head|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

function safeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  // Protocol-relative and bare domains are fine; anything with another scheme
  // (javascript:, data:, vbscript:) is not.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (!trimmed) return null;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function sanitizeCampaignHtml(input: string): string {
  let html = String(input ?? "");

  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(STRIP_WITH_CONTENT, "");
  // Unclosed dangerous tags, e.g. a bare "<script>" with no partner.
  html = html.replace(/<\/?(script|style|iframe|object|embed)\b[^>]*>/gi, "");

  html = html.replace(
    /<(\/?)([a-zA-Z0-9-]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_match, closing: string, tagRaw: string, attrs: string) => {
      const tag = tagRaw.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return ""; // drop the tag, keep inner text
      if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      if (tag === "img") {
        const src = /src\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
        const value = src?.[2] ?? src?.[3] ?? src?.[4] ?? "";
        // Only absolute http(s). A data: URI would balloon the message and get
        // it flagged as spam; a relative path can't resolve inside an inbox.
        if (!/^https?:\/\//i.test(value.trim())) return "";
        const altMatch = /alt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
        const alt = altMatch?.[2] ?? altMatch?.[3] ?? "";
        // Dimensions and styling are ours, not the editor's — this is what
        // keeps a big upload from blowing out the layout on a phone.
        return `<img src="${escapeAttr(value.trim())}" alt="${escapeAttr(alt)}" style="max-width:100%;height:auto;display:block;margin:16px 0;border-radius:6px;" />`;
      }
      if (tag === "a") {
        const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
        const value = href?.[2] ?? href?.[3] ?? href?.[4] ?? "";
        const url = safeUrl(value);
        if (!url) return "<a>";
        // target/rel are fixed rather than carried over from the editor.
        return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">`;
      }
      // Every other allowed tag keeps zero attributes — no style, no class,
      // no on* handlers, nothing to reason about.
      return `<${tag}>`;
    },
  );

  return html.trim();
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function escapeHtml(s: string) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

/** Rough plain-text alternative. Every HTML email needs one for deliverability. */
export function htmlToText(html: string): string {
  return html
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (_m, alt) => (alt ? `[${alt}]\n` : "[image]\n"))
    .replace(/<img[^>]*>/gi, "[image]\n")
    .replace(/<\/(p|h2|h3|li|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── the shell ────────────────────────────────────────────────────

/** The default accent colour, used when an email has no event theme to hand. */
export const ACCENT = "#662EFF";

/**
 * The site header, rebuilt for email: the logo plus the event name.
 *
 * Laid out with a table because flexbox doesn't work in Outlook, and the logo
 * is a PNG because Gmail refuses to render SVG. Email can't load the site's
 * heading font, so the name uses the nearest geometric faces a mail client
 * is likely to have.
 */
function renderWordmark(site: string, eventName: string, logoUrl?: string): string {
  // align="center" is for Outlook, which ignores `margin:0 auto` on tables.
  return `<a href="${escapeAttr(site)}" style="text-decoration:none;color:#1a1d24;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td style="padding-right:12px;vertical-align:middle;">
        <img src="${escapeAttr(logoUrl || `${site}/email-logo.png`)}" width="34" height="34" alt=""
             style="display:block;border:0;outline:none;text-decoration:none;" />
      </td>
      <td style="vertical-align:middle;">
        <span style="font-family:'Avenir Next','Century Gothic',Futura,'Segoe UI',Helvetica,Arial,sans-serif;font-size:21px;font-weight:600;letter-spacing:-0.01em;line-height:1;color:#06153B;white-space:nowrap;">
          ${escapeHtml(eventName)}
        </span>
      </td>
    </tr></table>
  </a>`;
}
export function renderCampaignEmail(opts: {
  /** The event's name, for the header and the footer. */
  eventName: string;
  /** The event's logo, if it has its own. Use a PNG or JPEG: Gmail won't show SVG. */
  logoUrl?: string;
  bodyHtml: string;
  unsubscribeUrl: string | null;
  recipientName?: string | null;
  /** Internal staff mail: real send, but no unsubscribe applies. */
  internal?: boolean;
  /** Transactional mail about something the recipient did, e.g. submitting. */
  footerNote?: string;
}): string {
  const { eventName, logoUrl, bodyHtml, unsubscribeUrl, internal, footerNote } = opts;
  const site = siteUrl();

  const footer = footerNote
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
         ${escapeHtml(footerNote)}
       </p>`
    : unsubscribeUrl
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
         You're receiving this because you registered for ${escapeHtml(eventName)}.
         <a href="${escapeAttr(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>.
       </p>`
    : internal
      ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
           Internal message to the ${escapeHtml(eventName)} admin team.
         </p>`
      : `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
           Preview — the real send includes a working unsubscribe link.
         </p>`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1d24;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e3e5ea;border-radius:10px;overflow:hidden;">
    <div style="padding:18px 32px;border-bottom:1px solid #e3e5ea;text-align:center;">
      ${renderWordmark(site, eventName, logoUrl)}
    </div>
    <div style="padding:32px;font-size:15px;line-height:1.65;">
      ${bodyHtml}
    </div>
    <div style="padding:20px 32px;border-top:1px solid #e3e5ea;background:#fafbfc;">
      ${footer}
    </div>
  </div>
</body></html>`;
}

// ── sending ──────────────────────────────────────────────────────
// The provider (Resend, SMTP…) is chosen in src/server/providers/email.ts.

export type { OutgoingEmail, SendResult } from "@/server/providers/email";

/** Whether this server can send email at all. */
export function emailConfigured(): boolean {
  return emailTransport() !== null;
}

export async function sendOne(
  message: OutgoingEmail,
  from = DEFAULT_FROM,
): Promise<SendOneResult> {
  const transport = emailTransport();
  if (!transport) return { ok: false, error: EMAIL_NOT_CONFIGURED };
  return transport.sendOne(message, from);
}

export async function sendBatch(
  messages: OutgoingEmail[],
  from = DEFAULT_FROM,
): Promise<SendResult> {
  const transport = emailTransport();
  if (!transport)
    return { sent: 0, failed: messages.length, errors: [EMAIL_NOT_CONFIGURED] };
  return transport.sendBatch(messages, from);
}
