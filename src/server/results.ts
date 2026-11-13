// Computing and locking the final ranking. Admin-only: callers go through the
// admin panel's guards before reaching these.

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, results_locks, scores, submissions, tie_breaks, type LockedPlace } from "@/db/schema";
import { drawBubble, monteCarloTop, type ScoreRow } from "@/lib/monte-carlo";
import { rankByAverage } from "@/lib/ranking";
import type { EventRow } from "./event";

/**
 * Run the ranking for an event, lock the top places, and move the event to
 * the results phase. How many places, and the rubric, come from the event's
 * settings, as does the method: evened-out and tested for stability, or plain
 * averages. Either way the same scores (and seed) always give the same ranking.
 */
export async function computeAndLockResults(
  event: EventRow,
  seed: number,
): Promise<{ top6: LockedPlace[]; seed: number }> {
  const { rubric, topN } = event.settings;
  const [scoreRows, subs] = await Promise.all([
    db()
      .select({
        judge_id: scores.judge_id,
        submission_id: scores.submission_id,
        marks: scores.marks,
      })
      .from(scores)
      .where(eq(scores.event_id, event.id)),
    db()
      .select({ id: submissions.id, project_name: submissions.project_name })
      .from(submissions)
      .where(
        and(
          eq(submissions.event_id, event.id),
          eq(submissions.hidden_from_judges, false),
          eq(submissions.is_submission_complete, true),
        ),
      ),
  ]);

  // Scores for a submission that has since been hidden don't count.
  const eligible = new Set(subs.map((s) => s.id));
  const counted: ScoreRow[] = scoreRows.filter((s) => eligible.has(s.submission_id));

  let top6: LockedPlace[];
  if (event.settings.judging.ranking === "average") {
    // Plain averages. There is no chance involved, so every place is certain.
    top6 = rankByAverage(counted, subs.map((s) => s.id), rubric)
      .slice(0, topN)
      .map((r, i) => ({ submission_id: r.submission_id, rank: i + 1, probability: 1 }));
  } else {
    const mc = monteCarloTop(counted, subs, rubric, { seed, trials: 1000, topN });
    const drawn = drawBubble(mc.bubble, mc.rankings, topN - mc.autoLocked.length, seed);
    top6 = [...mc.autoLocked, ...drawn].slice(0, topN).map((sid, i) => ({
      submission_id: sid,
      rank: i + 1,
      probability: mc.rankings.find((r) => r.submission_id === sid)?.p_top_n ?? 0,
    }));
  }

  await db().transaction(async (tx) => {
    await tx
      .insert(results_locks)
      .values({ event_id: event.id, seed, top6 })
      .onConflictDoUpdate({
        target: results_locks.event_id,
        set: { seed, top6, locked_at: new Date() },
      });
    await tx
      .update(events)
      .set({ phase: "results", closed_at: new Date() })
      .where(eq(events.id, event.id));
  });
  return { top6, seed };
}

export async function recordTieBreak(
  eventId: string,
  input: { winnerId: string; loserId: string; reason: string; decidedBy: string },
): Promise<void> {
  await db().insert(tie_breaks).values({
    event_id: eventId,
    winning_submission_id: input.winnerId,
    losing_submission_id: input.loserId,
    reason: input.reason,
    decided_by: input.decidedBy,
  });
}
