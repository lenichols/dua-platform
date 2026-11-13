import { describe, expect, it } from "vitest";
import { DEFAULT_RUBRIC, DEFAULT_SETTINGS, resolveSettings, rubricSchema, settingsSchema } from "./event-settings";
import { SCALE_MAX, marksComplete, totalScore } from "./rubric";

const all = (n: number) => Object.fromEntries(DEFAULT_RUBRIC.criteria.map((c) => [c.key, n]));
const criterion = (key: string, weight: number) => ({
  key,
  label: key,
  weight,
  anchors: { limited: "", solid: "", exceptional: "" },
  example: "",
});

describe("the default rubric and settings", () => {
  it("are valid", () => {
    expect(rubricSchema.safeParse(DEFAULT_RUBRIC).success).toBe(true);
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });
});

describe("rubric rules", () => {
  it("require weights that add up to 100", () => {
    const r = rubricSchema.safeParse({ criteria: [criterion("a", 60), criterion("b", 30)], tieBreakers: [] });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("add up to 90");
  });

  it("require a different key for each criterion", () => {
    expect(
      rubricSchema.safeParse({ criteria: [criterion("a", 50), criterion("a", 50)], tieBreakers: [] }).success,
    ).toBe(false);
  });

  it("require tie-breakers to be criteria on the rubric", () => {
    expect(
      rubricSchema.safeParse({ criteria: [criterion("a", 100)], tieBreakers: ["b"] }).success,
    ).toBe(false);
    expect(
      rubricSchema.safeParse({ criteria: [criterion("a", 100)], tieBreakers: ["a"] }).success,
    ).toBe(true);
  });

  it("refuse keys that aren't simple lowercase ids", () => {
    for (const key of ["Impact", "two words", "1st", ""]) {
      expect(rubricSchema.safeParse({ criteria: [criterion(key, 100)], tieBreakers: [] }).success).toBe(false);
    }
  });
});

describe("totalScore", () => {
  it("gives 100 for top marks and 20 for the lowest", () => {
    expect(totalScore(DEFAULT_RUBRIC, all(SCALE_MAX))).toBeCloseTo(100);
    expect(totalScore(DEFAULT_RUBRIC, all(1))).toBeCloseTo(20);
  });

  it("weights each criterion by its share", () => {
    const first = DEFAULT_RUBRIC.criteria[0];
    expect(totalScore(DEFAULT_RUBRIC, { [first.key]: SCALE_MAX })).toBeCloseTo(first.weight);
  });

  it("counts a missing or null mark as zero, and ignores marks not on the rubric", () => {
    expect(totalScore(DEFAULT_RUBRIC, {})).toBe(0);
    expect(totalScore(DEFAULT_RUBRIC, { impact: null })).toBe(0);
    expect(totalScore(DEFAULT_RUBRIC, { ...all(5), charisma: 5 })).toBeCloseTo(100);
  });

  it("follows a custom rubric", () => {
    const rubric = { criteria: [criterion("craft", 70), criterion("story", 30)], tieBreakers: [] };
    expect(totalScore(rubric, { craft: 5, story: 1 })).toBeCloseTo(76);
  });
});

describe("marksComplete", () => {
  it("needs a whole mark from 1 to 5 on every criterion", () => {
    expect(marksComplete(DEFAULT_RUBRIC, all(3))).toBe(true);
    expect(marksComplete(DEFAULT_RUBRIC, { ...all(3), impact: 0 })).toBe(false);
    expect(marksComplete(DEFAULT_RUBRIC, { ...all(3), impact: 6 })).toBe(false);
    expect(marksComplete(DEFAULT_RUBRIC, { ...all(3), impact: 2.5 })).toBe(false);
    const { impact: _dropped, ...partial } = all(3);
    expect(marksComplete(DEFAULT_RUBRIC, partial)).toBe(false);
  });
});

describe("resolveSettings", () => {
  it("gives the defaults for an empty or missing record", () => {
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps what's stored and fills the rest from the defaults", () => {
    const s = resolveSettings({ name: "City Hack", tracks: ["Transit", "Housing"] });
    expect(s.name).toBe("City Hack");
    expect(s.tracks).toEqual(["Transit", "Housing"]);
    expect(s.dates).toBe(DEFAULT_SETTINGS.dates);
  });

  it("falls back for a single invalid value without discarding the others", () => {
    const s = resolveSettings({
      name: "City Hack",
      topN: 500,
      rubric: { criteria: [criterion("a", 40)], tieBreakers: [] },
    });
    expect(s.name).toBe("City Hack");
    expect(s.topN).toBe(DEFAULT_SETTINGS.topN);
    expect(s.rubric).toEqual(DEFAULT_RUBRIC);
  });

  it("drops duplicate list entries", () => {
    expect(resolveSettings({ tracks: ["A", "B", "A"] }).tracks).toEqual(["A", "B"]);
  });
});
