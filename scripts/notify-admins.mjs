#!/usr/bin/env node
// Email the admin team a notice. Reads the roster from admin_users so it can
// never drift from who actually has access.
//
//   node --env-file=.env.local scripts/notify-admins.mjs --dry-run
//   node --env-file=.env.local scripts/notify-admins.mjs --rotate
//   node --env-file=.env.local scripts/notify-admins.mjs --rotate --only someone@example.org
//
// With --rotate, each recipient gets a NEW password generated, stored, and
// included in their own email — nobody receives anyone else's, and no
// plaintext password is ever typed on a command line or written to a file.
// Without it, the email is a notice only and contains no credentials.

import { createClient } from "@supabase/supabase-js";
import { die, generatePassword, hashPassword, parseArgs } from "./_password.mjs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Where the admin panel lives, who the mail is from, and what the event is
// called. Pass --event-name, or set EVENT_NAME, to match src/lib/site.ts.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
const DEFAULT_FROM = process.env.EMAIL_FROM;

const args = parseArgs(process.argv.slice(2));
const dryRun = args["dry-run"] === true || args["dry-run"] === "true";
const rotate = args.rotate === true || args.rotate === "true";
const from = typeof args.from === "string" ? args.from : DEFAULT_FROM;
const EVENT_NAME = String(args["event-name"] ?? process.env.EVENT_NAME ?? "Hackathon");
if (!SITE) die("NEXT_PUBLIC_SITE_URL missing — set it to your deployment's public address");
if (!from) die("EMAIL_FROM missing — set it, or pass --from 'Name <address>'");
const only = typeof args.only === "string" ? args.only.toLowerCase() : null;

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey && !dryRun) die("RESEND_API_KEY missing — pass --env-file=.env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) die("Missing Supabase env vars — pass --env-file=.env.local");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: admins, error } = await supabase
  .from("admin_users")
  .select("id, name, email, role")
  .eq("is_active", true)
  .order("name");
if (error) die(error.message);

const recipients = (admins ?? []).filter((a) => !only || a.email.toLowerCase() === only);
if (recipients.length === 0) die("No matching active admins");

const subject = rotate
  ? `Your ${EVENT_NAME} admin password`
  : `Your ${EVENT_NAME} admin password was rotated`;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function textBody(name, password) {
  const first = name.split(" ")[0];
  const credential = password
    ? `Your new password is:

    ${password}

Sign in here: ${SITE}/admin
Your username is this email address.`
    : `Your new password will NOT arrive by email. An organizer is sending it
to you directly over Slack or text — no second email is coming, so
don't wait for one.

Sign in here: ${SITE}/admin`;

  return `Hi ${first},

The admin passwords for the ${EVENT_NAME} control panel were
rotated today. Your previous password no longer works.

${credential}

Please change it once you're in: open the "Account" tab and set a
password only you know. Until you do, this password has sat in an
inbox and was seen by whoever set it up. The Account tab is available
to every role, including read-only.

If you didn't expect this email, reply and tell us right away.

— ${EVENT_NAME}`;
}

function htmlBody(name, password) {
  const credential = password
    ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Your new password is:</p>
    <p style="margin:0 0 16px;padding:14px 16px;background:#f4f5f7;border:1px solid #e3e5ea;border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:17px;letter-spacing:0.02em;">${esc(password)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Sign in at <a href="${SITE}/admin" style="color:#E02D3C;">${SITE}/admin</a> —
      your username is this email address.
    </p>`
    : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Your new password <strong>will not arrive by email</strong>. An organizer is sending it
      to you directly over Slack or text — no second email is coming, so don't wait for one.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Sign in at <a href="${SITE}/admin" style="color:#E02D3C;">${SITE}/admin</a>.
    </p>`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1d24;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e5ea;border-radius:10px;padding:32px;">
    <div style="text-align:center;">
    <a href="${SITE}" style="text-decoration:none;color:#1a1d24;">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 22px;"><tr>
        <td style="padding-right:12px;vertical-align:middle;">
          <img src="${SITE}/email-logo.png" width="34" height="34" alt="" style="display:block;border:0;" />
        </td>
        <td style="vertical-align:middle;">
          <span style="font-family:Garamond,Georgia,'Times New Roman',Times,serif;font-size:25px;font-weight:500;letter-spacing:-0.01em;line-height:1;color:#1a1d24;white-space:nowrap;">
            ${esc(EVENT_NAME)}
          </span>
        </td>
      </tr></table>
    </a>
    </div>
    <h1 style="margin:0 0 20px;font-size:19px;line-height:1.35;">Your admin password</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${esc(name.split(" ")[0])},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      The admin passwords for the ${esc(EVENT_NAME)} control panel were rotated today.
      <strong>Your previous password no longer works.</strong>
    </p>
    ${credential}
    <p style="margin:0 0 16px;padding:12px 14px;background:#fdf2f4;border-left:3px solid #E02D3C;font-size:14px;line-height:1.6;">
      <strong>Please change it once you're in.</strong> Open the <strong>Account</strong> tab and set a
      password only you know. Until you do, this password has sat in an inbox and was seen by
      whoever set it up. The Account tab is available to every role, including read-only.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
      If you didn't expect this email, reply and tell us right away.
    </p>
  </div>
</body></html>`;
}

console.log(`From: ${from}`);
console.log(`Mode: ${rotate ? "ROTATE — each email contains that person's new password" : "notice only, no credentials"}`);
console.log(`Recipients (${recipients.length}):`);
for (const r of recipients) console.log(`  ${r.name} <${r.email}>  [${r.role}]`);

if (dryRun) {
  const sample = rotate ? generatePassword() : null;
  console.log(`\n--- subject ---\n${subject}`);
  console.log(`\n--- text body (${recipients[0].name}) ---\n${textBody(recipients[0].name, sample)}`);
  console.log("\n(dry run — nothing sent, nothing rotated)");
  process.exit(0);
}

let sent = 0;
let failed = 0;
for (const r of recipients) {
  let password = null;

  if (rotate) {
    password = generatePassword();
    const { error: updErr } = await supabase
      .from("admin_users")
      .update({ password_hash: await hashPassword(password) })
      .eq("id", r.id);
    if (updErr) {
      failed++;
      console.error(`✗ ${r.email}: couldn't set password (${updErr.message}) — not emailed`);
      continue;
    }
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [r.email],
      subject,
      text: textBody(r.name, password),
      html: htmlBody(r.name, password),
    }),
  });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    failed++;
    // The password was already rotated, so a send failure locks them out until
    // someone re-runs this. Say so loudly rather than failing quietly.
    console.error(
      `✗ ${r.email}: ${payload.message ?? res.statusText}` +
        (rotate ? " — PASSWORD ALREADY CHANGED, re-run --rotate --only for this address" : ""),
    );
  } else {
    sent++;
    console.log(`✓ ${r.email} (id ${payload.id})`);
  }
}

console.log(`\nSent ${sent}, failed ${failed}.`);
process.exit(failed > 0 ? 1 : 0);
