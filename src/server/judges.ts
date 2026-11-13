// The judge and mentor roster, and how they sign in.

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { judges } from "@/db/schema";
import { plainAll } from "./plain";
import { judgePasswords } from "./providers/judge-passwords";

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
  const [existing] = await db()
    .select({ id: judges.id })
    .from(judges)
    .where(and(eq(judges.event_id, eventId), emailMatches(email)))
    .limit(1);

  let id: string;
  if (existing) {
    await db()
      .update(judges)
      .set({ name: input.name.trim(), role: input.role, is_active: true })
      .where(eq(judges.id, existing.id));
    id = existing.id;
  } else {
    const [row] = await db()
      .insert(judges)
      .values({ event_id: eventId, name: input.name.trim(), email, role: input.role, is_active: true })
      .returning({ id: judges.id });
    id = row.id;
  }
  if (input.password) await judgePasswords().set({ id, email }, input.password);
  return { id };
}

export async function deactivateJudge(eventId: string, judgeId: string): Promise<void> {
  await db()
    .update(judges)
    .set({ is_active: false })
    .where(and(eq(judges.event_id, eventId), eq(judges.id, judgeId)));
}

/**
 * Give every active judge and mentor the same sign-in password, which the
 * organizers hand out themselves.
 */
export async function setSharedJudgePassword(
  eventId: string,
  password: string,
): Promise<{ updated: number }> {
  const active = await db()
    .select({ id: judges.id, email: judges.email })
    .from(judges)
    .where(and(eq(judges.event_id, eventId), eq(judges.is_active, true)));
  const passwords = judgePasswords();
  for (const j of active) await passwords.set(j, password);
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
  const passwords = judgePasswords();
  const [row] = await db()
    .select({
      id: judges.id,
      name: judges.name,
      email: judges.email,
      role: judges.role,
      is_active: judges.is_active,
    })
    .from(judges)
    .where(and(eq(judges.event_id, eventId), emailMatches(email)))
    .limit(1);
  if (!row) {
    await passwords.verifyNobody(password);
    return { onRoster: false, isActive: null, hasPassword: false, passwordMatches: false, judge: null };
  }
  const passwordMatches = await passwords.verify(row, password);
  return {
    onRoster: true,
    isActive: row.is_active,
    hasPassword: passwordMatches || (await passwords.isSet(row)),
    passwordMatches,
    judge:
      passwordMatches && row.is_active
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
