import { describe, expect, it } from "vitest";
import { DEFAULT_RUBRIC } from "./event-settings";
import { rankByAverage } from "./ranking";

const flat = (sub: string, mark: number) => ({
  submission_id: sub,
  marks: Object.fromEntries(DEFAULT_RUBRIC.criteria.map((c) => [c.key, mark])),
});

describe("rankByAverage", () => {
  it("orders projects by the average of their judges' totals", () => {
    const r = rankByAverage([flat("a", 3), flat("a", 5), flat("b", 5), flat("c", 2)], ["a", "b", "c"], DEFAULT_RUBRIC);
    expect(r.map((x) => x.submission_id)).toEqual(["b", "a", "c"]);
    expect(r[0].average).toBeCloseTo(100);
    expect(r[1].average).toBeCloseTo(80);
    expect(r[1].n_judges).toBe(2);
  });

  it("does not reward a harsh judge's favourite over a generous judge's average", () => {
    // The plain method takes marks at face value: this is what sets it apart.
    const r = rankByAverage([flat("harsh-favourite", 3), flat("generous-average", 4)], ["harsh-favourite", "generous-average"], DEFAULT_RUBRIC);
    expect(r[0].submission_id).toBe("generous-average");
  });

  it("settles level totals by the rubric's tie-breakers, in order", () => {
    const base = flat("x", 3).marks;
    const r = rankByAverage(
      [
        { submission_id: "b", marks: { ...base, impact: 3, innovation: 5 } },
        { submission_id: "a", marks: { ...base, impact: 5, innovation: 3 } },
      ],
      ["b", "a"],
      DEFAULT_RUBRIC,
    );
    expect(r[0].average).toBeCloseTo(r[1].average);
    expect(r.map((x) => x.submission_id)).toEqual(["a", "b"]);
  });

  it("leaves out projects nobody scored, and gives the same order every time", () => {
    const scores = [flat("b", 4), flat("a", 4)];
    const first = rankByAverage(scores, ["a", "b", "unscored"], DEFAULT_RUBRIC);
    expect(first.map((x) => x.submission_id)).toEqual(["a", "b"]);
    expect(rankByAverage([...scores].reverse(), ["unscored", "b", "a"], DEFAULT_RUBRIC)).toEqual(first);
  });
});
