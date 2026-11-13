// Project submissions: the public form writes them, a signed link edits
// them, and admins manage them. What judges see is in judging.ts.

import { and, desc, eq } from "drizzle-orm";
import { db, isUniqueViolation } from "@/db";
import { submissions } from "@/db/schema";
import type { SubmissionInput } from "@/lib/submission-schema";
import type { EventRow } from "./event";
import { plainAll } from "./plain";
import { submissionsAccepting } from "./policy";

export type SubmitOutcome =
  | { ok: true; id: string }
  | { ok: false; reason: "closed" | "duplicate" | "missing" };

/** A new submission. Refused while submissions are closed. */
export async function createSubmission(
  event: EventRow,
  input: SubmissionInput,
  custom: Record<string, string> = {},
): Promise<SubmitOutcome> {
  if (!submissionsAccepting(event)) return { ok: false, reason: "closed" };
  try {
    const [row] = await db()
      .insert(submissions)
      .values({ ...input, custom, event_id: event.id, is_submission_complete: true })
      .returning({ id: submissions.id });
    return { ok: true, id: row.id };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "duplicate" };
    throw e;
  }
}

/**
 * Replace a submission's form answers. Review flags, visibility and the
 * created date stay as they were. The caller has verified the edit link;
 * closing submissions cuts off every link.
 */
export async function updateSubmission(
  event: EventRow,
  id: string,
  input: SubmissionInput,
  custom: Record<string, string> = {},
): Promise<SubmitOutcome> {
  if (!submissionsAccepting(event)) return { ok: false, reason: "closed" };
  try {
    const [row] = await db()
      .update(submissions)
      .set({ ...input, custom, updated_at: new Date() })
      .where(and(eq(submissions.event_id, event.id), eq(submissions.id, id)))
      .returning({ id: submissions.id });
    return row ? { ok: true, id: row.id } : { ok: false, reason: "missing" };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "duplicate" };
    throw e;
  }
}

/** A submission's current answers, to pre-fill the edit form. */
export async function getSubmissionForEdit(
  event: EventRow,
  id: string,
  fields: readonly string[],
): Promise<{ values: Record<string, string>; custom: Record<string, string> } | null> {
  const [row] = await db()
    .select()
    .from(submissions)
    .where(and(eq(submissions.event_id, event.id), eq(submissions.id, id)))
    .limit(1);
  if (!row) return null;
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (row as Record<string, unknown>)[f];
    if (v != null && v !== "") out[f] = String(v);
  }
  return { values: out, custom: row.custom };
}

/** Everything, contact details included, for the admin panel. */
export async function listSubmissionsForAdmin(eventId: string) {
  const rows = await db()
    .select()
    .from(submissions)
    .where(eq(submissions.event_id, eventId))
    .orderBy(desc(submissions.created_at));
  return plainAll(rows);
}

export async function setSubmissionHidden(
  eventId: string,
  id: string,
  hidden: boolean,
): Promise<void> {
  await db()
    .update(submissions)
    .set({ hidden_from_judges: hidden })
    .where(and(eq(submissions.event_id, eventId), eq(submissions.id, id)));
}
