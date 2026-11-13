// The judge and mentor roster, and how they sign in.

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { judges } from "@/db/schema";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/admin-password";
import { plainAll } from "./plain";

export type JudgeRole = "judge" | "mentor";

export const MIN_JUDGE_PASSWORD_LENGTH = 8;

export type JudgeSession = {
  id: string;
  name: string;
  is_active: boolean;
  role: JudgeRole;
};

const emailMatches = (email: string) =>
  sql`lower(${judges.email}) = ${email.trim().toLowerCase()}`;

/** The roster for the admin panel. Never includes password hashes. */
export async function listJudges(eventId: string) {
  const rows = await db()
    .select({
      id: judges.id,
      name: judges.name,
      email: judges.email,
      is_active: judges.is_active,
      role: judges.role,
      created_at: judges.created_at,
      has_password: sql<boolean>`${judges.password_hash} is not null`,
    })
    .from(judges)
    .where(eq(judges.event_id, eventId))
    .orderBy(asc(judges.name));
  return plainAll(rows).map((j) => ({ ...j, role: j.role as JudgeRole }));
}

/** For resolving a session cookie. Null if the judge is gone or deactivated. */
export async function getActiveJudge(
  eventId: string,
  judgeId: string,
): Promise<JudgeSession | null> {
  const [row] = await db()
    .select({ id: judges.id, name: judges.name, is_active: judges.is_active, role: judges.role })
    .from(judges)
    .where(and(eq(judges.event_id, eventId), eq(judges.id, judgeId)))
    .limit(1);
  if (!row?.is_active) return null;
  return { ...row, role: row.role as JudgeRole };
}

/**
 * Add someone to the roster, or update them if the email is already on it
 * (which also reactivates them). Passing a password sets it; leaving it out
 * keeps whatever they had.
 */
export async function upsertJudge(
  eventId: string,
  input: { name: string; email: string; role: JudgeRole; password?: string },
): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  const password_hash = input.password ? await hashAdminPassword(input.password) : undefined;
  const [existing] = await db()
    .select({ id: judges.id })
    .from(judges)
    .where(and(eq(judges.event_id, eventId), emailMatches(email)))
    .limit(1);
  if (existing) {
    await db()
      .update(judges)
      .set({
        name: input.name.trim(),
        role: input.role,
        is_active: true,
        ...(password_hash ? { password_hash } : {}),
      })
      .where(eq(judges.id, existing.id));
    return { id: existing.id };
  }
  const [row] = await db()
    .insert(judges)
    .values({
      event_id: eventId,
      name: input.name.trim(),
      email,
      role: input.role,
      is_active: true,
      password_hash: password_hash ?? null,
    })
    .returning({ id: judges.id });
  return { id: row.id };
}

export async function deactivateJudge(eventId: string, judgeId: string): Promise<void> {
  await db()
    .update(judges)
    .set({ is_active: false })
    .where(and(eq(judges.event_id, eventId), eq(judges.id, judgeId)));
}

/**
 * Give every active judge and mentor the same sign-in password, which the
 * organizers hand out themselves. Each row gets its own salted hash.
 */
export async function setSharedJudgePassword(
  eventId: string,
  password: string,
): Promise<{ updated: number }> {
  const active = await db()
    .select({ id: judges.id })
    .from(judges)
    .where(and(eq(judges.event_id, eventId), eq(judges.is_active, true)));
  for (const j of active) {
    await db()
      .update(judges)
      .set({ password_hash: await hashAdminPassword(password) })
      .where(eq(judges.id, j.id));
  }
  return { updated: active.length };
}

export type SignInCheck = {
  onRoster: boolean;
  isActive: boolean | null;
  hasPassword: boolean;
  passwordMatches: boolean;
};

/** Why a sign-in would or wouldn't work, for the admin panel's diagnose tool. */
export async function checkJudgeSignIn(
  eventId: string,
  email: string,
  password: string,
): Promise<SignInCheck & { judge: JudgeSession | null }> {
  const [row] = await db()
    .select()
    .from(judges)
    .where(and(eq(judges.event_id, eventId), emailMatches(email)))
    .limit(1);
  if (!row) {
    // Spend the same time as a real check so timing doesn't reveal who's on
    // the roster.
    await verifyAdminPassword(password, DUMMY_HASH);
    return { onRoster: false, isActive: null, hasPassword: false, passwordMatches: false, judge: null };
  }
  const passwordMatches = await verifyAdminPassword(password, row.password_hash ?? DUMMY_HASH);
  const matches = passwordMatches && row.password_hash != null;
  return {
    onRoster: true,
    isActive: row.is_active,
    hasPassword: row.password_hash != null,
    passwordMatches: matches,
    judge:
      matches && row.is_active
        ? { id: row.id, name: row.name, is_active: true, role: row.role as JudgeRole }
        : null,
  };
}

/** The judge who just signed in, or null for a wrong email, password or inactive account. */
export async function verifyJudgeSignIn(
  eventId: string,
  email: string,
  password: string,
): Promise<JudgeSession | null> {
  return (await checkJudgeSignIn(eventId, email, password)).judge;
}

// A well-formed hash of a password nobody has, for the constant-time path.
const DUMMY_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;
