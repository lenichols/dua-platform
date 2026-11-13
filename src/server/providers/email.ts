// How email leaves the app. Pick a provider with EMAIL_PROVIDER, or let it be
// worked out from which settings are present:
//
//   resend   RESEND_API_KEY                 https://resend.com
//   smtp     SMTP_URL                       any mail server or service
//   console  (EMAIL_PROVIDER=console)       prints to the server log; sends nothing
//
// To add another provider, write a function that returns an EmailTransport
// and add it to `transports` below.

import nodemailer from "nodemailer";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string | null;
};

export type SendResult = { sent: number; failed: number; errors: string[] };
export type SendOneResult = { ok: true; id: string } | { ok: false; error: string };

export interface EmailTransport {
  sendOne(message: OutgoingEmail, from: string): Promise<SendOneResult>;
  sendBatch(messages: OutgoingEmail[], from: string): Promise<SendResult>;
}

export type EmailProviderName = "resend" | "smtp" | "console";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * One-click unsubscribe. Gmail and Yahoo require this on bulk mail, and
 * without it a blast is far likelier to land in spam.
 */
function unsubscribeHeaders(m: OutgoingEmail): Record<string, string> | undefined {
  if (!m.unsubscribeUrl) return undefined;
  return {
    "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Sends a batch one message at a time, counting what worked. */
async function oneByOne(
  transport: Pick<EmailTransport, "sendOne">,
  messages: OutgoingEmail[],
  from: string,
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, errors: [] };
  for (const m of messages) {
    const r = await transport.sendOne(m, from);
    if (r.ok) result.sent++;
    else {
      result.failed++;
      // Keep the record readable when a whole blast fails the same way.
      if (result.errors.length < 10) result.errors.push(`${m.to}: ${r.error}`);
    }
  }
  return result;
}

// ── Resend ───────────────────────────────────────────────────────

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
/** Resend caps a batch at 100 and the default account rate limit is 2 req/s. */
const RESEND_BATCH_SIZE = 100;
const RESEND_BATCH_PAUSE_MS = 600;

function resend(apiKey: string): EmailTransport {
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const payload = (m: OutgoingEmail, from: string) => ({
    from,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
    ...(unsubscribeHeaders(m) ? { headers: unsubscribeHeaders(m) } : {}),
  });

  return {
    async sendOne(m, from) {
      try {
        const res = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify(payload(m, from)),
        });
        const body = await res.json().catch(() => ({}) as Record<string, unknown>);
        if (!res.ok) return { ok: false, error: String(body.message ?? res.statusText) };
        return { ok: true, id: String(body.id ?? "") };
      } catch (e) {
        return { ok: false, error: message(e) };
      }
    },

    async sendBatch(messages, from) {
      const result: SendResult = { sent: 0, failed: 0, errors: [] };
      for (let i = 0; i < messages.length; i += RESEND_BATCH_SIZE) {
        const chunk = messages.slice(i, i + RESEND_BATCH_SIZE);
        const label = `Batch ${i / RESEND_BATCH_SIZE + 1}`;
        try {
          const res = await fetch(RESEND_BATCH_ENDPOINT, {
            method: "POST",
            headers,
            body: JSON.stringify(chunk.map((m) => payload(m, from))),
          });
          const body = await res.json().catch(() => ({}) as Record<string, unknown>);
          if (res.ok) result.sent += chunk.length;
          else {
            // A whole chunk failing means those recipients got nothing — count
            // every one so the campaign record reflects reality.
            result.failed += chunk.length;
            result.errors.push(
              `${label} (${chunk.length} recipients): ${body.message ?? res.statusText}`,
            );
          }
        } catch (e) {
          result.failed += chunk.length;
          result.errors.push(`${label}: ${message(e)}`);
        }
        if (i + RESEND_BATCH_SIZE < messages.length) {
          await new Promise((r) => setTimeout(r, RESEND_BATCH_PAUSE_MS));
        }
      }
      return result;
    },
  };
}

// ── SMTP ─────────────────────────────────────────────────────────

function smtp(url: string): EmailTransport {
  // Add ?pool=true to SMTP_URL to reuse one connection across a large batch.
  const transporter = nodemailer.createTransport(url);
  const transport: EmailTransport = {
    async sendOne(m, from) {
      try {
        const info = await transporter.sendMail({
          from,
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          headers: unsubscribeHeaders(m),
        });
        return { ok: true, id: String(info.messageId ?? "") };
      } catch (e) {
        return { ok: false, error: message(e) };
      }
    },
    sendBatch: (messages, from) => oneByOne(transport, messages, from),
  };
  return transport;
}

// ── console ──────────────────────────────────────────────────────

/** For local development: shows what would be sent, sends nothing. */
function consoleLog(): EmailTransport {
  const transport: EmailTransport = {
    async sendOne(m, from) {
      console.log(
        `\n── email (not sent: EMAIL_PROVIDER=console) ──\nFrom: ${from}\nTo: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n──────────────────────────────────────────────\n`,
      );
      return { ok: true, id: "console" };
    },
    sendBatch: (messages, from) => oneByOne(transport, messages, from),
  };
  return transport;
}

// ── choosing one ─────────────────────────────────────────────────

/** Which provider the settings select, or null if email isn't set up. */
export function emailProviderName(env = process.env): EmailProviderName | null {
  const chosen = env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (chosen === "console") return "console";
  if (chosen === "resend") return env.RESEND_API_KEY ? "resend" : null;
  if (chosen === "smtp") return env.SMTP_URL ? "smtp" : null;
  if (chosen) return null;
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_URL) return "smtp";
  return null;
}

export const EMAIL_NOT_CONFIGURED =
  "Email isn't set up on this server. Set RESEND_API_KEY or SMTP_URL (see the README).";

let cached: { key: string; transport: EmailTransport } | null = null;

/** The configured transport, or null if email isn't set up. */
export function emailTransport(): EmailTransport | null {
  const name = emailProviderName();
  if (!name) return null;
  const key = `${name}:${process.env.RESEND_API_KEY ?? ""}:${process.env.SMTP_URL ?? ""}`;
  if (cached?.key !== key) {
    const transport =
      name === "resend"
        ? resend(process.env.RESEND_API_KEY!)
        : name === "smtp"
          ? smtp(process.env.SMTP_URL!)
          : consoleLog();
    cached = { key, transport };
  }
  return cached.transport;
}
