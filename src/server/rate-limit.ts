// Slows down password guessing. Failed sign-ins are recorded per key (the
// kind of account plus the email); too many in a short window and further
// attempts are refused until the window passes.

import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sign_in_failures } from "@/db/schema";

export const MAX_FAILURES = 8;
export const WINDOW_MINUTES = 15;

const windowStart = () => new Date(Date.now() - WINDOW_MINUTES * 60_000);

export function signInKey(kind: "admin" | "judge", email: string): string {
  return `${kind}:${email.trim().toLowerCase() || "(shared)"}`;
}

/** True when this key has used up its attempts for now. */
export async function isLockedOut(key: string): Promise<boolean> {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(sign_in_failures)
    .where(and(eq(sign_in_failures.key, key), gt(sign_in_failures.failed_at, windowStart())));
  return Number(row?.n ?? 0) >= MAX_FAILURES;
}

export async function recordFailure(key: string): Promise<void> {
  await db().insert(sign_in_failures).values({ key });
  // Tidy up as we go so the table never grows without bound.
  await db()
    .delete(sign_in_failures)
    .where(lt(sign_in_failures.failed_at, new Date(Date.now() - 24 * 60 * 60_000)));
}

export async function clearFailures(key: string): Promise<void> {
  await db().delete(sign_in_failures).where(eq(sign_in_failures.key, key));
}

export const LOCKED_OUT_MESSAGE = `Too many failed attempts. Wait ${WINDOW_MINUTES} minutes and try again.`;
