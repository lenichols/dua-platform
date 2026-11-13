import { createHmac, timingSafeEqual } from "crypto";

/**
 * Unsubscribe links are HMAC-signed rather than backed by a stored token
 * column: the registration id plus the app secret is enough to prove the link
 * came from us, and there's no per-recipient row to generate, store, or clean
 * up. Same secret the admin session cookie uses.
 */
function secret() {
  const s = process.env.SUBMISSION_EDIT_SECRET || process.env.ADMIN_PASSWORD;
  if (!s)
    throw new Error("SUBMISSION_EDIT_SECRET or ADMIN_PASSWORD env var required");
  return s;
}

export function unsubscribeToken(registrationId: string): string {
  return createHmac("sha256", secret())
    .update(`unsubscribe:${registrationId}`)
    .digest("hex");
}

export function verifyUnsubscribeToken(
  registrationId: string,
  token: string,
): boolean {
  const expected = unsubscribeToken(registrationId);
  const a = Buffer.from(token, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unsubscribeUrl(baseUrl: string, registrationId: string): string {
  const u = new URL("/unsubscribe", baseUrl);
  u.searchParams.set("id", registrationId);
  u.searchParams.set("t", unsubscribeToken(registrationId));
  return u.toString();
}
