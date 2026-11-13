import { createHmac, timingSafeEqual } from "crypto";
import {
  CRIMSON,
  escapeHtml,
  htmlToText,
  renderCampaignEmail,
  sendOne,
} from "./email";

/**
 * Private edit links for submissions. Like unsubscribe links, they're
 * HMAC-signed rather than stored: the submission id plus the app secret
 * proves the link came from us. Anyone holding the link can edit that one
 * submission, and only while submissions are open (checked by the caller).
 */
function secret() {
  const s = process.env.SUBMISSION_EDIT_SECRET || process.env.ADMIN_PASSWORD;
  if (!s)
    throw new Error("SUBMISSION_EDIT_SECRET or ADMIN_PASSWORD env var required");
  return s;
}

export function editToken(submissionId: string): string {
  return createHmac("sha256", secret())
    .update(`edit-submission:${submissionId}`)
    .digest("hex");
}

export function verifyEditToken(submissionId: string, token: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(token)) return false;
  const a = Buffer.from(token, "hex");
  const b = Buffer.from(editToken(submissionId), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function editUrl(baseUrl: string, submissionId: string): string {
  const u = new URL("/submit/edit", baseUrl);
  u.searchParams.set("id", submissionId);
  u.searchParams.set("t", editToken(submissionId));
  return u.toString();
}

/**
 * Mail a submitter their edit link. `late` adds a line for people who
 * submitted before links existed, when the confirmation screen promised one.
 */
export async function sendEditLinkEmail(opts: {
  to: string;
  name: string | null;
  project: string;
  url: string;
  late?: boolean;
  /** The event's name and when submissions close, as shown to participants. */
  event: { name: string; submissionDeadline: string };
}) {
  const EVENT = opts.event;
  const first = (opts.name ?? "").trim().split(/\s+/)[0];
  const bodyHtml = `<p>Hi${first ? ` ${escapeHtml(first)}` : ""},</p>
${opts.late ? "<p>Our confirmation screen said we'd email you a link to edit your submission. Here it is, and sorry for the wait.</p>\n" : ""}<p>Thanks for submitting <strong>${escapeHtml(opts.project)}</strong> to ${escapeHtml(EVENT.name)}. If you need to change anything, use your private edit link:</p>
<p><a href="${escapeHtml(opts.url)}" style="display:inline-block;background:${CRIMSON};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Edit your submission</a></p>
<p style="font-size:13px;color:#6b7280;word-break:break-all;">${escapeHtml(opts.url)}</p>
<p>The link works until submissions close (${escapeHtml(EVENT.submissionDeadline)}). Anyone with it can edit your submission, so share it only with your team.</p>
<p>The ${escapeHtml(EVENT.name)} team</p>`;
  return sendOne({
    to: opts.to,
    subject: `Your edit link for ${opts.project}`,
    html: renderCampaignEmail({
      eventName: EVENT.name,
      bodyHtml,
      unsubscribeUrl: null,
      footerNote:
        `You're receiving this because you submitted a project to ${EVENT.name}.`,
    }),
    text: htmlToText(bodyHtml),
  });
}
