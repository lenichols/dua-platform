// What the admin panel loads. Raw, unfiltered event data: callers must have
// an admin session before calling anything here.

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { recusals, results_locks, scores, submissions } from "@/db/schema";
import { plainAll } from "./plain";

/** How many judges have scored each submission. */
export async function judgingProgress(eventId: string) {
  const rows = await db()
    .select({
      submission_id: submissions.id,
      project_name: submissions.project_name,
      votes: sql<number>`count(${scores.id})::int`,
    })
    .from(submissions)
    .leftJoin(scores, eq(scores.submission_id, submissions.id))
    .where(eq(submissions.event_id, eventId))
    .groupBy(submissions.id, submissions.project_name);
  return rows.map((r) => ({ ...r, votes: Number(r.votes) }));
}

/** Who has scored what, and when. No score values. */
export async function scoreActivity(eventId: string) {
  const rows = await db()
    .select({
      judge_id: scores.judge_id,
      submission_id: scores.submission_id,
      updated_at: scores.updated_at,
    })
    .from(scores)
    .where(eq(scores.event_id, eventId));
  return plainAll(rows);
}

export async function listRecusals(eventId: string) {
  const rows = await db()
    .select({
      judge_id: recusals.judge_id,
      submission_id: recusals.submission_id,
      reason: recusals.reason,
      created_at: recusals.created_at,
    })
    .from(recusals)
    .where(eq(recusals.event_id, eventId))
    .orderBy(desc(recusals.created_at));
  return plainAll(rows);
}

export async function getResultsLockForAdmin(eventId: string) {
  const [row] = await db()
    .select()
    .from(results_locks)
    .where(eq(results_locks.event_id, eventId))
    .limit(1);
  return row
    ? { seed: row.seed, top6: row.top6, locked_at: row.locked_at.toISOString() }
    : null;
}
