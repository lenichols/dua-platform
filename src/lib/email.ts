// Resend transport + the HTML shell every campaign is wrapped in.
// Server-only: never import from a client component.

import { EVENT } from "@/lib/site";

const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Resend caps a batch at 100 and the default account rate limit is 2 req/s. */
const BATCH_SIZE = 100;
const BATCH_PAUSE_MS = 600;

/**
 * The From header. Set EMAIL_FROM to an address on a domain your email
 * provider has verified, e.g. `My Hackathon <noreply@mydomain.org>`.
 * The fallback is a placeholder that no provider will accept.
 */
export const DEFAULT_FROM =
  process.env.EMAIL_FROM?.trim() || `${EVENT.name} <noreply@example.org>`;

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

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

/** Brand crimson — matches `crimson.DEFAULT` in tailwind.config.ts. */
export const CRIMSON = "#E02D3C";

/**
 * The site header, rebuilt for email: the logo plus the event name.
 *
 * Laid out with a table because flexbox doesn't work in Outlook, and the logo
 * is a PNG because Gmail refuses to render SVG. The font stack mirrors
 * `fontFamily.serif` minus the webfont variable — email can't load EB Garamond,
 * so recipients land on Garamond/Georgia, which is the same fallback most
 * visitors see on the site anyway.
 */
function renderWordmark(site: string): string {
  // align="center" is for Outlook, which ignores `margin:0 auto` on tables.
  return `<a href="${escapeAttr(site)}" style="text-decoration:none;color:#1a1d24;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td style="padding-right:12px;vertical-align:middle;">
        <img src="${escapeAttr(site)}/email-logo.png" width="34" height="34" alt=""
             style="display:block;border:0;outline:none;text-decoration:none;" />
      </td>
      <td style="vertical-align:middle;">
        <span style="font-family:Garamond,Georgia,'Times New Roman',Times,serif;font-size:25px;font-weight:500;letter-spacing:-0.01em;line-height:1;color:#1a1d24;white-space:nowrap;">
          ${escapeHtml(EVENT.name)}
        </span>
      </td>
    </tr></table>
  </a>`;
}
export function renderCampaignEmail(opts: {
  bodyHtml: string;
  unsubscribeUrl: string | null;
  recipientName?: string | null;
  /** Internal staff mail: real send, but no unsubscribe applies. */
  internal?: boolean;
  /** Transactional mail about something the recipient did, e.g. submitting. */
  footerNote?: string;
}): string {
  const { bodyHtml, unsubscribeUrl, internal, footerNote } = opts;
  const site = siteUrl();

  const footer = footerNote
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
         ${escapeHtml(footerNote)}
       </p>`
    : unsubscribeUrl
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
         You're receiving this because you registered for ${escapeHtml(EVENT.name)}.
         <a href="${escapeAttr(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>.
       </p>`
    : internal
      ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
           Internal message to the ${escapeHtml(EVENT.name)} admin team.
         </p>`
      : `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
           Preview — the real send includes a working unsubscribe link.
         </p>`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1d24;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e3e5ea;border-radius:10px;overflow:hidden;">
    <div style="padding:18px 32px;border-bottom:1px solid #e3e5ea;text-align:center;">
      ${renderWordmark(site)}
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

// ── transport ────────────────────────────────────────────────────
export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string | null;
};

export type SendResult = { sent: number; failed: number; errors: string[] };

function toResendPayload(m: OutgoingEmail, from: string) {
  const payload: Record<string, unknown> = {
    from,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
  };
  if (m.unsubscribeUrl) {
    // One-click unsubscribe. Gmail and Yahoo require this on bulk mail, and
    // without it a blast this size is far likelier to land in spam.
    payload.headers = {
      "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  return payload;
}

export async function sendOne(
  message: OutgoingEmail,
  from = DEFAULT_FROM,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured." };

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(toResendPayload(message, from)),
  });
  const payload = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok)
    return { ok: false, error: String(payload.message ?? res.statusText) };
  return { ok: true, id: String(payload.id ?? "") };
}

export async function sendBatch(
  messages: OutgoingEmail[],
  from = DEFAULT_FROM,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey)
    return { sent: 0, failed: messages.length, errors: ["RESEND_API_KEY is not configured."] };

  const result: SendResult = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE);

    let res: Response;
    try {
      res = await fetch(RESEND_BATCH_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((m) => toResendPayload(m, from))),
      });
    } catch (e) {
      result.failed += chunk.length;
      result.errors.push(
        `Batch ${i / BATCH_SIZE + 1}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    const payload = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      // A whole chunk failing means those recipients got nothing — count every
      // one so the campaign record reflects reality rather than optimism.
      result.failed += chunk.length;
      result.errors.push(
        `Batch ${i / BATCH_SIZE + 1} (${chunk.length} recipients): ${payload.message ?? res.statusText}`,
      );
    } else {
      result.sent += chunk.length;
    }

    if (i + BATCH_SIZE < messages.length) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }

  return result;
}
