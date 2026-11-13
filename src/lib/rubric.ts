// Scoring maths for a rubric. The rubric itself (criteria, weights, guidance)
// is part of an event's settings: see src/lib/event-settings.ts.

import { SCALE_MAX, type Rubric } from "./event-settings";

export { SCALE_MAX };
export type { Criterion, Rubric } from "./event-settings";

/** A judge's marks for one submission, by criterion key. */
export type Marks = Record<string, number>;
/** A judge's evidence sentences for one submission, by criterion key. */
export type Evidence = Record<string, string>;

/**
 * Total out of 100: each mark as a share of the top of the scale, weighted
 * by its criterion. A missing mark counts as zero.
 */
export function totalScore(rubric: Rubric, marks: Partial<Record<string, number | null>>): number {
  return rubric.criteria.reduce(
    (t, c) => t + ((marks[c.key] ?? 0) / SCALE_MAX) * c.weight,
    0,
  );
}

/** True when every criterion has a whole-number mark on the scale. */
export function marksComplete(rubric: Rubric, marks: Partial<Record<string, unknown>>): boolean {
  return rubric.criteria.every((c) => {
    const v = marks[c.key];
    return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= SCALE_MAX;
  });
}
