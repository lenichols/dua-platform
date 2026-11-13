// Computing and locking the final ranking. Admin-only: callers go through the
// admin panel's guards before reaching these.

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, results_locks, scores, submissions, tie_breaks, type LockedPlace } from "@/db/schema";
import { drawBubble, monteCarloTop, type ScoreRow } from "@/lib/monte-carlo";

export const TOP_N = 6;

/**
 * Run the ranking for an event, lock the top places, and move the event to
 * the results phase. The same seed over the same scores always gives the
 * same ranking.
 */
export async function computeAndLockResults(
  eventId: string,
  seed: number,
): Promise<{ top6: LockedPlace[]; seed: number }> {
  const [scoreRows, subs] = await Promise.all([
    db()
      .select({
        judge_id: scores.judge_id,
        submission_id: scores.submission_id,
        impact: scores.impact,
        innovation: scores.innovation,
        sustainability: scores.sustainability,
        feasibility: scores.feasibility,
        scalability: scores.scalability,
      })
      .from(scores)
      .where(eq(scores.event_id, eventId)),
    db()
      .select({ id: submissions.id, project_name: submissions.project_name })
      .from(submissions)
      .where(
        and(
          eq(submissions.event_id, eventId),
          eq(submissions.hidden_from_judges, false),
          eq(submissions.is_submission_complete, true),
        ),
      ),
  ]);

  // Scores for a submission that has since been hidden don't count.
  const eligible = new Set(subs.map((s) => s.id));
  const counted = (scoreRows as ScoreRow[]).filter((s) => eligible.has(s.submission_id));

  const mc = monteCarloTop(counted, subs, { seed, trials: 1000, topN: TOP_N });
  const drawn = drawBubble(mc.bubble, mc.rankings, TOP_N - mc.autoLocked.length, seed);
  const top6: LockedPlace[] = [...mc.autoLocked, ...drawn].slice(0, TOP_N).map((sid, i) => ({
    submission_id: sid,
    rank: i + 1,
    probability: mc.rankings.find((r) => r.submission_id === sid)?.p_top_n ?? 0,
  }));

  await db().transaction(async (tx) => {
    await tx
      .insert(results_locks)
      .values({ event_id: eventId, seed, top6 })
      .onConflictDoUpdate({
        target: results_locks.event_id,
        set: { seed, top6, locked_at: new Date() },
      });
    await tx
      .update(events)
      .set({ phase: "results", closed_at: new Date() })
      .where(eq(events.id, eventId));
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
