import { afterEach, describe, expect, it, vi } from "vitest";
import { emailProviderName, emailTransport } from "./email";
import { authProviderName } from "./judge-passwords";
import { storageProviderName } from "./storage";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("choosing an email provider", () => {
  it("is off when nothing is set", () => {
    expect(emailProviderName(env({}))).toBeNull();
  });

  it("follows whichever settings are present, preferring Resend", () => {
    expect(emailProviderName(env({ RESEND_API_KEY: "k" }))).toBe("resend");
    expect(emailProviderName(env({ SMTP_URL: "smtp://localhost" }))).toBe("smtp");
    expect(emailProviderName(env({ RESEND_API_KEY: "k", SMTP_URL: "smtp://localhost" }))).toBe("resend");
  });

  it("lets EMAIL_PROVIDER override, and stays off if that provider isn't set up", () => {
    const both = { RESEND_API_KEY: "k", SMTP_URL: "smtp://localhost" };
    expect(emailProviderName(env({ ...both, EMAIL_PROVIDER: "smtp" }))).toBe("smtp");
    expect(emailProviderName(env({ ...both, EMAIL_PROVIDER: " Console " }))).toBe("console");
    expect(emailProviderName(env({ EMAIL_PROVIDER: "smtp" }))).toBeNull();
    expect(emailProviderName(env({ EMAIL_PROVIDER: "resend", SMTP_URL: "smtp://localhost" }))).toBeNull();
    expect(emailProviderName(env({ ...both, EMAIL_PROVIDER: "carrier-pigeon" }))).toBeNull();
  });
});

describe("the console email provider", () => {
  it("prints the message and sends nothing", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "console");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const message = { to: "a@example.org", subject: "Hello", html: "<p>Hi</p>", text: "Hi" };

    expect(await emailTransport()!.sendOne(message, "Dua <noreply@example.org>")).toMatchObject({ ok: true });
    const batch = await emailTransport()!.sendBatch([message, message], "Dua <noreply@example.org>");
    expect(batch).toEqual({ sent: 2, failed: 0, errors: [] });
    expect(log.mock.calls[0][0]).toContain("Subject: Hello");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the Resend email provider", () => {
  const message = {
    to: "a@example.org",
    subject: "Hello",
    html: "<p>Hi</p>",
    text: "Hi",
    unsubscribeUrl: "https://example.org/unsubscribe?id=1",
  };

  it("sends one-click unsubscribe headers and reports the id", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));

    expect(await emailTransport()!.sendOne(message, "Dua <noreply@example.org>")).toEqual({ ok: true, id: "abc" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init!.body));
    expect(body.to).toEqual(["a@example.org"]);
    expect(body.headers["List-Unsubscribe"]).toBe("<https://example.org/unsubscribe?id=1>");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("counts every recipient in a batch the service refuses", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 }),
    );
    const result = await emailTransport()!.sendBatch([message, message, message], "Dua <noreply@example.org>");
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(3);
    expect(result.errors[0]).toContain("domain not verified");
  });

  it("reports a network failure instead of throwing", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(await emailTransport()!.sendOne(message, "Dua <noreply@example.org>")).toEqual({
      ok: false,
      error: "network down",
    });
  });
});

describe("choosing where files and passwords are kept", () => {
  it("defaults to the database and the built-in password store", () => {
    expect(storageProviderName(env({}))).toBe("database");
    expect(authProviderName(env({}))).toBe("builtin");
  });

  it("accepts the documented names, ignoring case and spaces", () => {
    expect(storageProviderName(env({ STORAGE_PROVIDER: " S3 " }))).toBe("s3");
    expect(storageProviderName(env({ STORAGE_PROVIDER: "supabase" }))).toBe("supabase");
    expect(authProviderName(env({ AUTH_PROVIDER: "Supabase" }))).toBe("supabase");
  });

  it("refuses a misspelt provider rather than quietly using the default", () => {
    expect(() => storageProviderName(env({ STORAGE_PROVIDER: "s4" }))).toThrow(/STORAGE_PROVIDER/);
    expect(() => authProviderName(env({ AUTH_PROVIDER: "supabse" }))).toThrow(/AUTH_PROVIDER/);
  });
});
