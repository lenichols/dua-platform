// Shared password helpers for the CLI scripts.
//
// The hash format MUST stay in sync with src/lib/admin-password.ts —
// `scrypt$<salt hex>$<key hex>`, 16-byte salt, 64-byte key, Node's scrypt
// defaults. Keep this the only copy so the two can't drift.

import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export const MIN_PASSWORD_LENGTH = 10;
export const ROLES = ["owner", "admin", "viewer"];

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Readable, unambiguous one-off password — no I/l/1/O/0. */
export function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (const b of randomBytes(16)) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12)}`;
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const [flag, inline] = key.slice(2).split("=");
    if (inline !== undefined) {
      args[flag] = inline;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[flag] = true;
    else args[flag] = argv[++i];
  }
  return args;
}

export function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
