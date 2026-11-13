// Everything judges and mentors can read or write, and the results built from
// their scores. Each function takes the viewer and checks src/server/policy.ts
// before touching the database.

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { recusals, results_locks, scores, submissions, type LockedPlace } from "@/db/schema";
import { RUBRIC, evidenceKey, type EvidenceKey, type RubricCategory } from "@/lib/rubric";
import type { EventRow } from "./event";
import {
  NotAllowed,
  canRecuse,
  canScore,
  canSeeJudgeNotes,
  canSeeResults,
  canSeeScoresOf,
  canSeeSubmissions,
  canSeeThisSubmission,
  type Viewer,
} from "./policy";

// ── what judges see of a submission ──────────────────────────────
// No emails, phone numbers, addresses or LinkedIn profiles: judges get the
// project and the team's names, nothing that identifies how to contact them.
// The test in judging.test.ts fails if a contact column is added here.

export const JUDGE_VISIBLE_COLUMNS = [
  "id",
  "project_name",
  "team_name",
  "solo_or_team",
  "challenge_track",
  "project_category",
  "project_description",
  "project_description_summary",
  "technologies_used",
  "team_size",
  "github_url",
  "live_demo_url",
  "demo_video_url",
  "linkedin_post_url",
  "member1_name",
  "member2_name",
  "member3_name",
  "member4_name",
  "member5_name",
  "created_at",
  "focus_area",
  "impact_focus",
  "target_region",
  "solution_stage",
  "country",
  "customer_type",
  "region",
  "area_of_specification",
  "problem_statement",
  "core_problem",
  "applies_ai",
  "mentor_name",
  "demo_video_short_url",
  "pitch_deck_url",
  "summary_url",
  "disclosure_statement",
  "problem_brief",
] as const satisfies readonly (keyof typeof submissions.$inferSelect)[];

type JudgeVisibleKey = (typeof JUDGE_VISIBLE_COLUMNS)[number];
export type JudgeVisibleSubmission = Record<JudgeVisibleKey, string | number | null>;

const judgeVisibleSelection = Object.fromEntries(
  JUDGE_VISIBLE_COLUMNS.map((c) => [c, submissions[c]]),
) as { [K in JudgeVisibleKey]: (typeof submissions)[K] };

function toJudgeVisible(row: Record<string, unknown>): JudgeVisibleSubmission {
  const out: Record<string, string | number | null> = {};
  for (const c of JUDGE_VISIBLE_COLUMNS) {
    const v = row[c];
    out[c] = v instanceof Date ? v.toISOString() : ((v ?? null) as string | number | null);
  }
  return out as JudgeVisibleSubmission;
}

/** In a judge's queue: complete and not hidden by an organizer. */
const inJudgesQueue = and(
  eq(submissions.hidden_from_judges, false),
  eq(submissions.is_submission_complete, true),
);

export type SubmissionSummary = {
  id: string;
  project_name: string;
  team_name: string | null;
  solo_or_team: string | null;
  challenge_track: string | null;
  project_description_summary: string | null;
};

/** The list on the judge dashboard. Empty unless the viewer may see submissions. */
export async function listSubmissionsForJudging(
  event: EventRow,
  viewer: Viewer,
): Promise<SubmissionSummary[]> {
  if (!canSeeSubmissions(viewer, event.phase)) return [];
  return db()
    .select({
      id: submissions.id,
      project_name: submissions.project_name,
      team_name: submissions.team_name,
      solo_or_team: submissions.solo_or_team,
      challenge_track: submissions.challenge_track,
      project_description_summary: submissions.project_description_summary,
    })
    .from(submissions)
    .where(and(eq(submissions.event_id, event.id), inJudgesQueue));
}

/** One submission, without contact details. Null if it doesn't exist or isn't the viewer's to see. */
export async function getSubmissionForViewer(
  event: EventRow,
  viewer: Viewer,
  submissionId: string,
): Promise<JudgeVisibleSubmission | null> {
  if (!canSeeSubmissions(viewer, event.phase)) return null;
  if (!isUuid(submissionId)) return null;
  const [row] = await db()
    .select({
      ...judgeVisibleSelection,
      hidden_from_judges: submissions.hidden_from_judges,
      is_submission_complete: submissions.is_submission_complete,
    })
    .from(submissions)
    .where(and(eq(submissions.event_id, event.id), eq(submissions.id, submissionId)))
    .limit(1);
  if (!row) return null;
  if (!canSeeThisSubmission(viewer, event.phase, row)) return null;
  return toJudgeVisible(row);
}

// ── a judge's own scores and conflicts ───────────────────────────

export type ScoreValues = Record<RubricCategory, number> & Record<EvidenceKey, string | null>;

const scoreSelection = Object.fromEntries(
  RUBRIC.flatMap((c) => [
    [c.key, scores[c.key]],
    [evidenceKey(c.key), scores[evidenceKey(c.key)]],
  ]),
) as { [K in RubricCategory | EvidenceKey]: (typeof scores)[K] };

/** A judge's own score for one submission. Never anyone else's. */
export async function getOwnScore(
  event: EventRow,
  viewer: Viewer,
  submissionId: string,
): Promise<ScoreValues | null> {
  if (viewer.kind !== "judge" || !canSeeScoresOf(viewer, viewer.judgeId)) return null;
  if (!isUuid(submissionId)) return null;
  const [row] = await db()
    .select(scoreSelection)
    .from(scores)
    .where(
      and(
        eq(scores.event_id, event.id),
        eq(scores.judge_id, viewer.judgeId),
        eq(scores.submission_id, submissionId),
      ),
    )
    .limit(1);
  return (row as ScoreValues | undefined) ?? null;
}

/** Which submissions this judge has scored and which they've recused from. */
export async function getOwnProgress(
  event: EventRow,
  viewer: Viewer,
): Promise<{ scoredIds: string[]; recusedIds: string[] }> {
  if (viewer.kind !== "judge" || viewer.role !== "judge") return { scoredIds: [], recusedIds: [] };
  const [scored, recused] = await Promise.all([
    db()
      .select({ id: scores.submission_id })
      .from(scores)
      .where(and(eq(scores.event_id, event.id), eq(scores.judge_id, viewer.judgeId))),
    db()
      .select({ id: recusals.submission_id })
      .from(recusals)
      .where(and(eq(recusals.event_id, event.id), eq(recusals.judge_id, viewer.judgeId))),
  ]);
  return { scoredIds: scored.map((r) => r.id), recusedIds: recused.map((r) => r.id) };
}

export async function getOwnRecusal(
  event: EventRow,
  viewer: Viewer,
  submissionId: string,
): Promise<{ reason: string | null } | null> {
  if (viewer.kind !== "judge" || viewer.role !== "judge") return null;
  if (!isUuid(submissionId)) return null;
  const [row] = await db()
    .select({ reason: recusals.reason })
    .from(recusals)
    .where(
      and(
        eq(recusals.event_id, event.id),
        eq(recusals.judge_id, viewer.judgeId),
        eq(recusals.submission_id, submissionId),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ── scoring ──────────────────────────────────────────────────────

/** One sentence per criterion; this just stops a bare "ok". */
export const MIN_EVIDENCE_LENGTH = 15;
const MAX_EVIDENCE_LENGTH = 2000;

const scoreShape = Object.fromEntries(
  RUBRIC.flatMap((c) => [
    [c.key, z.coerce.number().int().min(1).max(5)],
    [
      evidenceKey(c.key),
      z
        .string()
        .trim()
        .min(MIN_EVIDENCE_LENGTH, `Write one sentence of evidence for ${c.label}.`)
        .max(MAX_EVIDENCE_LENGTH),
    ],
  ]),
);
export const scoreInputSchema = z.object(scoreShape);

export type ScoreInput = Record<RubricCategory, number> & Record<EvidenceKey, string>;

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Save (or replace) the viewer's score for a submission.
 *
 * The judge is always the viewer: there is no way to pass someone else's id.
 * Refused unless judging is open, the viewer is a judge (not a mentor), the
 * submission is in the judges' queue, and the judge hasn't recused.
 */
export async function saveScore(
  event: EventRow,
  viewer: Viewer,
  submissionId: string,
  input: unknown,
): Promise<SaveResult> {
  if (viewer.kind !== "judge" || !canScore(viewer, event.phase)) {
    return { ok: false, error: scoringRefusal(event, viewer) };
  }
  const parsed = scoreInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Score every criterion from 1 to 5.",
    };
  }
  const values = parsed.data as ScoreInput;

  if (!(await getSubmissionForViewer(event, viewer, submissionId))) {
    return { ok: false, error: "That submission isn't available for judging." };
  }
  if (await getOwnRecusal(event, viewer, submissionId)) {
    return {
      ok: false,
      error: "You declared a conflict on this project, so you can't score it.",
    };
  }

  await db()
    .insert(scores)
    .values({ event_id: event.id, judge_id: viewer.judgeId, submission_id: submissionId, ...values })
    .onConflictDoUpdate({
      target: [scores.judge_id, scores.submission_id],
      set: { ...values, updated_at: new Date() },
    });
  return { ok: true };
}

function scoringRefusal(event: EventRow, viewer: Viewer): string {
  if (viewer.kind !== "judge") return "Your session expired — sign in again.";
  if (viewer.role !== "judge") return "Mentors can view submissions but can't score them.";
  if (event.phase === "submissions") return "Judging hasn't started yet.";
  return "Voting has closed — contact the organizers.";
}

/**
 * Declare a conflict of interest. Removes any score the judge already gave
 * the project, in the same transaction, so a conflicted score never counts.
 */
export async function declareConflict(
  event: EventRow,
  viewer: Viewer,
  submissionId: string,
  reason: string,
): Promise<SaveResult> {
  if (viewer.kind !== "judge" || !canRecuse(viewer, event.phase)) {
    return { ok: false, error: recusalRefusal(event, viewer) };
  }
  if (!(await getSubmissionForViewer(event, viewer, submissionId))) {
    return { ok: false, error: "That submission isn't available for judging." };
  }
  const judgeId = viewer.judgeId;
  const trimmed = reason.trim().slice(0, 500) || null;
  await db().transaction(async (tx) => {
    await tx
      .insert(recusals)
      .values({ event_id: event.id, judge_id: judgeId, submission_id: submissionId, reason: trimmed })
      .onConflictDoUpdate({
        target: [recusals.judge_id, recusals.submission_id],
        set: { reason: trimmed },
      });
    await tx
      .delete(scores)
      .where(and(eq(scores.judge_id, judgeId), eq(scores.submission_id, submissionId)));
  });
  return { ok: true };
}

export async function withdrawConflict(
  event: EventRow,
  viewer: Viewer,
  submissionId: string,
): Promise<SaveResult> {
  if (viewer.kind !== "judge" || !canRecuse(viewer, event.phase)) {
    return { ok: false, error: recusalRefusal(event, viewer) };
  }
  if (!isUuid(submissionId)) return { ok: false, error: "Unknown submission." };
  await db()
    .delete(recusals)
    .where(
      and(
        eq(recusals.event_id, event.id),
        eq(recusals.judge_id, viewer.judgeId),
        eq(recusals.submission_id, submissionId),
      ),
    );
  return { ok: true };
}

function recusalRefusal(event: EventRow, viewer: Viewer): string {
  if (viewer.kind !== "judge") return "Your session expired — sign in again.";
  if (viewer.role !== "judge") return "Only judges on the roster can recuse.";
  if (event.phase === "submissions") return "Judging hasn't started yet.";
  return "Voting has closed — contact the organizers.";
}

// ── results ──────────────────────────────────────────────────────

export type JudgeNotes = { label: string; lines: { criterion: string; text: string }[] };

/**
 * Every judge's evidence sentences for one submission, as "Judge A", "Judge
 * B"… in the order they scored. No names and no numbers, so the rule that
 * only averages are shared still holds.
 */
export async function listJudgeNotes(
  event: EventRow,
  viewer: Viewer,
  submissionId: string,
): Promise<JudgeNotes[]> {
  if (!canSeeJudgeNotes(viewer, event.phase)) return [];
  if (!isUuid(submissionId)) return [];
  const evidenceSelection = Object.fromEntries(
    RUBRIC.map((c) => [evidenceKey(c.key), scores[evidenceKey(c.key)]]),
  ) as { [K in EvidenceKey]: (typeof scores)[K] };
  const rows = await db()
    .select(evidenceSelection)
    .from(scores)
    .where(and(eq(scores.event_id, event.id), eq(scores.submission_id, submissionId)))
    .orderBy(asc(scores.created_at), asc(scores.id));
  return rows.map((n, i) => ({
    label: `Judge ${String.fromCharCode(65 + i)}`,
    lines: RUBRIC.map((c) => ({
      criterion: c.label,
      text: (n[evidenceKey(c.key)] ?? "").trim(),
    })).filter((l) => l.text.length > 0),
  }));
}

export type RubricAggregate = {
  submission_id: string;
  project_name: string;
  n_judges: number;
  avg_impact: number | null;
  avg_innovation: number | null;
  avg_sustainability: number | null;
  avg_feasibility: number | null;
  avg_scalability: number | null;
  avg_total: number | null;
};

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/**
 * Panel-wide averages per submission: never one judge's numbers.
 * The total is out of 100, weighted by the rubric in src/lib/rubric.ts.
 * Throws NotAllowed unless the viewer may see results.
 */
export async function rubricAggregates(
  event: EventRow,
  viewer: Viewer,
): Promise<RubricAggregate[]> {
  if (!canSeeResults(viewer, event.phase))
    throw new NotAllowed("Results aren't open yet.");

  const avg = (c: RubricCategory) => sql<string | null>`round(avg(${scores[c]}), 2)`;
  // 20 × the weighted sum of the 1–5 scores, built from the rubric so the
  // weights can't drift from src/lib/rubric.ts.
  const weighted = sql.join(
    RUBRIC.map((c) => sql`${sql.raw(String(c.weight / 100))} * ${scores[c.key]}`),
    sql` + `,
  );
  const rows = await db()
    .select({
      submission_id: submissions.id,
      project_name: submissions.project_name,
      n_judges: sql<number>`count(${scores.id})::int`,
      avg_impact: avg("impact"),
      avg_innovation: avg("innovation"),
      avg_sustainability: avg("sustainability"),
      avg_feasibility: avg("feasibility"),
      avg_scalability: avg("scalability"),
      avg_total: sql<string | null>`round(avg(20 * (${weighted})), 2)`,
    })
    .from(submissions)
    .leftJoin(scores, eq(scores.submission_id, submissions.id))
    .where(eq(submissions.event_id, event.id))
    .groupBy(submissions.id, submissions.project_name);

  return rows.map((r) => ({
    submission_id: r.submission_id,
    project_name: r.project_name,
    n_judges: Number(r.n_judges),
    avg_impact: num(r.avg_impact),
    avg_innovation: num(r.avg_innovation),
    avg_sustainability: num(r.avg_sustainability),
    avg_feasibility: num(r.avg_feasibility),
    avg_scalability: num(r.avg_scalability),
    avg_total: num(r.avg_total),
  }));
}

/** The locked final ranking. Null until computed, or if the viewer may not see results. */
export async function getResultsLock(
  event: EventRow,
  viewer: Viewer,
): Promise<{ seed: number; top6: LockedPlace[]; locked_at: string } | null> {
  if (!canSeeResults(viewer, event.phase)) return null;
  const [row] = await db()
    .select()
    .from(results_locks)
    .where(eq(results_locks.event_id, event.id))
    .limit(1);
  if (!row) return null;
  return { seed: row.seed, top6: row.top6, locked_at: row.locked_at.toISOString() };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids arrive from URLs; a malformed one is "not found", not a database error. */
export function isUuid(v: string): boolean {
  return UUID.test(v);
}
