// Where judges' and mentors' passwords are kept and checked. Pick a provider
// with AUTH_PROVIDER:
//
//   builtin   (default)  a scrypt hash on the judge's row in your database
//   supabase             Supabase Auth: each judge is a user in your project
//
// Only the password check is handed over. Who is on the roster, who is
// active, who is a judge and who a mentor, the session cookie and the
// sign-in throttle all stay in Dua whichever provider is used. Admin
// accounts always use the built-in store.
//
// To add another provider, write a function that returns a JudgePasswords and
// add it to `judgePasswords` below.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { judges } from "@/db/schema";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/admin-password";
import { supabaseAdmin, supabasePublic } from "./supabase";

/** The judge whose password is being checked or set. */
export type JudgeAccount = { id: string; email: string };

export interface JudgePasswords {
  /** True if this is the judge's password. */
  verify(judge: JudgeAccount, password: string): Promise<boolean>;
  set(judge: JudgeAccount, password: string): Promise<void>;
  /** Whether the judge has any password yet. */
  isSet(judge: JudgeAccount): Promise<boolean>;
  /**
   * Spend about as long as a real check on an email that isn't on the
   * roster, so response time doesn't reveal who is.
   */
  verifyNobody(password: string): Promise<void>;
}

export type AuthProviderName = "builtin" | "supabase";

// ── built in ─────────────────────────────────────────────────────

// A well-formed hash of a password nobody has.
const DUMMY_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;

async function storedHash(judgeId: string): Promise<string | null> {
  const [row] = await db()
    .select({ password_hash: judges.password_hash })
    .from(judges)
    .where(eq(judges.id, judgeId))
    .limit(1);
  return row?.password_hash ?? null;
}

function builtin(): JudgePasswords {
  return {
    async verify(judge, password) {
      const hash = await storedHash(judge.id);
      const matches = await verifyAdminPassword(password, hash ?? DUMMY_HASH);
      return matches && hash != null;
    },
    async set(judge, password) {
      await db()
        .update(judges)
        .set({ password_hash: await hashAdminPassword(password) })
        .where(eq(judges.id, judge.id));
    },
    async isSet(judge) {
      return (await storedHash(judge.id)) != null;
    },
    async verifyNobody(password) {
      await verifyAdminPassword(password, DUMMY_HASH);
    },
  };
}

// ── Supabase Auth ────────────────────────────────────────────────

/** Finds a Supabase user by email. The admin API lists users a page at a time. */
async function findSupabaseUserId(email: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Supabase Auth: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

function supabase(): JudgePasswords {
  return {
    async verify(judge, password) {
      const { data, error } = await supabasePublic().auth.signInWithPassword({
        email: judge.email.trim().toLowerCase(),
        password,
      });
      return !error && !!data.user;
    },

    async set(judge, password) {
      const admin = supabaseAdmin();
      const email = judge.email.trim().toLowerCase();
      const existing = await findSupabaseUserId(email);
      // email_confirm: the organizer vouches for the address by adding the
      // judge, so no confirmation email is needed.
      const { error } = existing
        ? await admin.auth.admin.updateUserById(existing, { password, email_confirm: true })
        : await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw new Error(`Supabase Auth: ${error.message}`);
    },

    async isSet(judge) {
      return (await findSupabaseUserId(judge.email)) != null;
    },

    async verifyNobody() {
      // The check is a network call either way; nothing local to even out.
    },
  };
}

// ── choosing one ─────────────────────────────────────────────────

export function authProviderName(env = process.env): AuthProviderName {
  const chosen = env.AUTH_PROVIDER?.trim().toLowerCase();
  if (!chosen || chosen === "builtin") return "builtin";
  if (chosen === "supabase") return "supabase";
  throw new Error(`AUTH_PROVIDER must be "builtin" or "supabase", not "${chosen}".`);
}

export function judgePasswords(): JudgePasswords {
  return authProviderName() === "supabase" ? supabase() : builtin();
}
