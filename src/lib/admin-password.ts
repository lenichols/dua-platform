import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Node's built-in scrypt — no extra dependency, and strong enough for the
// handful of staff accounts that can reach /admin.
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;
const PREFIX = "scrypt";

export { MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/admin-roles";

/** `scrypt$<salt hex>$<key hex>` — self-describing so we can rotate later. */
export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN);
  return `${PREFIX}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyAdminPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== PREFIX || !saltHex || !keyHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEYLEN) return false;

  const actual = await scryptAsync(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    KEYLEN,
  );
  return timingSafeEqual(actual, expected);
}

/** Readable, unambiguous one-off password to hand a new teammate. */
export function generateAdminPassword(): string {
  // No I/l/1/O/0 — these get mistyped when passwords are shared over chat.
  const alphabet = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12)}`;
}
