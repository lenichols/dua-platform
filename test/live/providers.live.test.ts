// Checks the optional providers against real services. Not part of `npm test`:
// run it with `npm run test:live` after starting the services you want to
// check and setting their variables. Each group is skipped when its
// variables are missing.
//
//   SMTP        LIVE_SMTP_URL (e.g. smtp://localhost:1025 for Mailpit)
//               LIVE_MAILPIT_URL (e.g. http://localhost:8025) to read it back
//   S3          LIVE_S3_ENDPOINT, LIVE_S3_BUCKET, LIVE_S3_ACCESS_KEY_ID,
//               LIVE_S3_SECRET_ACCESS_KEY, LIVE_S3_REGION, LIVE_S3_PUBLIC_URL
//   Supabase    LIVE_SUPABASE_URL, LIVE_SUPABASE_PUBLISHABLE_KEY,
//               LIVE_SUPABASE_SECRET_KEY

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkJudgeSignIn, setSharedJudgePassword, upsertJudge } from "@/server/judges";
import { emailTransport } from "@/server/providers/email";
import { judgePasswords } from "@/server/providers/judge-passwords";
import { fileStore } from "@/server/providers/storage";
import { makeEvent, resetDb } from "../fixtures";

const env = process.env;
const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

// A 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function roundTrip(eventId: string) {
  const { url } = await fileStore().put({
    eventId,
    bytes: PNG,
    contentType: "image/png",
    ext: "png",
    createdBy: "live test",
  });
  const res = await fetch(url);
  expect(res.status, `GET ${url}`).toBe(200);
  expect(res.headers.get("content-type")).toContain("image/png");
  expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  return url;
}

describe.skipIf(!env.LIVE_SMTP_URL)("SMTP", () => {
  it("delivers a message with one-click unsubscribe headers", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_URL = env.LIVE_SMTP_URL;
    const subject = `Dua live test ${Date.now()}`;
    const sent = await emailTransport()!.sendOne(
      {
        to: "someone@example.org",
        subject,
        html: "<p>Hello from the <strong>live</strong> test.</p>",
        text: "Hello from the live test.",
        unsubscribeUrl: "https://example.org/unsubscribe?id=1&t=abc",
      },
      "Dua Test <noreply@example.org>",
    );
    expect(sent.ok, JSON.stringify(sent)).toBe(true);

    if (!env.LIVE_MAILPIT_URL) return;
    const list = await (await fetch(`${env.LIVE_MAILPIT_URL}/api/v1/messages`)).json();
    const found = list.messages.find((m: { Subject: string }) => m.Subject === subject);
    expect(found, "message in the Mailpit inbox").toBeTruthy();
    expect(found.To[0].Address).toBe("someone@example.org");
    const headers = await (
      await fetch(`${env.LIVE_MAILPIT_URL}/api/v1/message/${found.ID}/headers`)
    ).json();
    expect(headers["List-Unsubscribe"][0]).toBe("<https://example.org/unsubscribe?id=1&t=abc>");
    expect(headers["List-Unsubscribe-Post"][0]).toBe("List-Unsubscribe=One-Click");
  });

  it("reports a failure instead of throwing when the server is unreachable", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_URL = "smtp://127.0.0.1:9";
    const sent = await emailTransport()!.sendOne(
      { to: "someone@example.org", subject: "x", html: "x", text: "x" },
      "Dua Test <noreply@example.org>",
    );
    expect(sent.ok).toBe(false);
  });
});

describe.skipIf(!env.LIVE_S3_ENDPOINT)("S3-compatible storage", () => {
  it("stores a file and serves it back unchanged", async () => {
    process.env.STORAGE_PROVIDER = "s3";
    process.env.S3_ENDPOINT = env.LIVE_S3_ENDPOINT;
    process.env.S3_BUCKET = env.LIVE_S3_BUCKET;
    process.env.S3_REGION = env.LIVE_S3_REGION;
    process.env.S3_ACCESS_KEY_ID = env.LIVE_S3_ACCESS_KEY_ID;
    process.env.S3_SECRET_ACCESS_KEY = env.LIVE_S3_SECRET_ACCESS_KEY;
    if (env.LIVE_S3_PUBLIC_URL) process.env.S3_PUBLIC_URL = env.LIVE_S3_PUBLIC_URL;
    await roundTrip("00000000-0000-4000-8000-000000000001");
  });

  it("reports a refused upload", async () => {
    process.env.STORAGE_PROVIDER = "s3";
    process.env.S3_ENDPOINT = env.LIVE_S3_ENDPOINT;
    process.env.S3_BUCKET = env.LIVE_S3_BUCKET;
    process.env.S3_REGION = env.LIVE_S3_REGION;
    process.env.S3_ACCESS_KEY_ID = env.LIVE_S3_ACCESS_KEY_ID;
    process.env.S3_SECRET_ACCESS_KEY = "not-the-secret";
    await expect(
      fileStore().put({
        eventId: "00000000-0000-4000-8000-000000000001",
        bytes: PNG,
        contentType: "image/png",
        ext: "png",
        createdBy: "live test",
      }),
    ).rejects.toThrow(/refused the upload/);
  });
});

describe.skipIf(!env.LIVE_SUPABASE_URL)("Supabase", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.SUPABASE_URL = env.LIVE_SUPABASE_URL;
    process.env.SUPABASE_PUBLISHABLE_KEY = env.LIVE_SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = env.LIVE_SUPABASE_SECRET_KEY;
  });

  it("Storage: creates the bucket if needed, stores a file and serves it back", async () => {
    process.env.STORAGE_PROVIDER = "supabase";
    process.env.SUPABASE_STORAGE_BUCKET = `dua-live-${Date.now()}`;
    const first = await roundTrip("00000000-0000-4000-8000-000000000002");
    const second = await roundTrip("00000000-0000-4000-8000-000000000002");
    expect(second).not.toBe(first);
  });

  it("Auth: sets, checks and changes a judge's password", async () => {
    process.env.AUTH_PROVIDER = "supabase";
    const judge = { id: "unused", email: `judge.${Date.now()}@example.org` };
    const passwords = judgePasswords();
    expect(await passwords.isSet(judge)).toBe(false);
    expect(await passwords.verify(judge, "correct horse battery")).toBe(false);

    await passwords.set(judge, "correct horse battery");
    expect(await passwords.isSet(judge)).toBe(true);
    expect(await passwords.verify(judge, "correct horse battery")).toBe(true);
    expect(await passwords.verify(judge, "wrong horse battery")).toBe(false);

    await passwords.set(judge, "a different passphrase");
    expect(await passwords.verify(judge, "correct horse battery")).toBe(false);
    expect(await passwords.verify(judge, "a different passphrase")).toBe(true);
  });

  it("Auth: the roster still decides who gets in", async () => {
    process.env.AUTH_PROVIDER = "supabase";
    const event = await makeEvent();
    const email = `roster.${Date.now()}@example.org`;
    const outsider = `outsider.${Date.now()}@example.org`;
    await upsertJudge(event.id, { name: "Jo", email, role: "judge" });
    expect((await setSharedJudgePassword(event.id, "shared passphrase 1")).updated).toBe(1);

    const ok = await checkJudgeSignIn(event.id, email.toUpperCase(), "shared passphrase 1");
    expect(ok.judge?.name).toBe("Jo");
    expect((await checkJudgeSignIn(event.id, email, "nope nope nope")).judge).toBeNull();

    // A real Supabase user who isn't on the roster is still refused.
    await judgePasswords().set({ id: "unused", email: outsider }, "shared passphrase 1");
    const refused = await checkJudgeSignIn(event.id, outsider, "shared passphrase 1");
    expect(refused).toMatchObject({ onRoster: false, judge: null });
  });
});
