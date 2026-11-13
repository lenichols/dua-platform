// The simple ranking: order projects by the plain average of their judges'
// totals. The alternative, in monte-carlo.ts, evens out harsh and generous
// judges first. Which one an event uses is a setting.

import { totalScore, type Marks, type Rubric } from "./rubric";

export type AverageRanking = {
  submission_id: string;
  n_judges: number;
  /** Average total out of 100. */
  average: number;
  /** Average mark on each tie-breaker criterion, in the rubric's order. */
  tiebreak_means: number[];
};

/**
 * Rank by average total, highest first. Level totals are ordered by the
 * rubric's tie-breakers in turn. Projects nobody scored are left out.
 */
export function rankByAverage(
  scores: { submission_id: string; marks: Marks }[],
  submissionIds: string[],
  rubric: Rubric,
): AverageRanking[] {
  const bySubmission = new Map<string, Marks[]>();
  for (const s of scores) {
    const list = bySubmission.get(s.submission_id) ?? [];
    list.push(s.marks);
    bySubmission.set(s.submission_id, list);
  }
  const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;

  return submissionIds
    .filter((id) => (bySubmission.get(id)?.length ?? 0) > 0)
    .map((id) => {
      const all = bySubmission.get(id)!;
      return {
        submission_id: id,
        n_judges: all.length,
        average: mean(all.map((m) => totalScore(rubric, m))),
        tiebreak_means: rubric.tieBreakers.map((k) => mean(all.map((m) => m[k] ?? 0))),
      };
    })
    .sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      for (let i = 0; i < a.tiebreak_means.length; i++) {
        if (b.tiebreak_means[i] !== a.tiebreak_means[i]) return b.tiebreak_means[i] - a.tiebreak_means[i];
      }
      // Stable and repeatable when everything is level.
      return a.submission_id < b.submission_id ? -1 : 1;
    });
}
