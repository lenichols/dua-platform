import { describe, expect, it } from "vitest";
import { RUBRIC, SCALE_MAX, TIE_BREAKERS, evidenceKey, totalScore } from "./rubric";

const all = (n: number) => Object.fromEntries(RUBRIC.map((c) => [c.key, n]));

describe("rubric", () => {
  it("has weights that add up to 100", () => {
    expect(RUBRIC.reduce((t, c) => t + c.weight, 0)).toBe(100);
  });

  it("has unique criterion keys", () => {
    const keys = RUBRIC.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("breaks ties only on criteria that exist", () => {
    const keys = RUBRIC.map((c) => c.key);
    for (const k of TIE_BREAKERS) expect(keys).toContain(k);
  });

  it("names the evidence field after the criterion", () => {
    expect(evidenceKey("impact")).toBe("impact_evidence");
  });
});

describe("totalScore", () => {
  it("gives 100 for top marks on every criterion", () => {
    expect(totalScore(all(SCALE_MAX))).toBeCloseTo(100);
  });

  it("gives 20 for the lowest mark on every criterion", () => {
    expect(totalScore(all(1))).toBeCloseTo(20);
  });

  it("weights each criterion by its share", () => {
    // Only the first criterion scored, at the top of the scale.
    const first = RUBRIC[0];
    expect(totalScore({ [first.key]: SCALE_MAX })).toBeCloseTo(first.weight);
  });

  it("counts a missing or null score as zero", () => {
    expect(totalScore({})).toBe(0);
    expect(totalScore({ impact: null })).toBe(0);
  });
});
