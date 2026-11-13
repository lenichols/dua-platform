import { describe, expect, it } from "vitest";
import { drawBubble, monteCarloTop, type ScoreRow } from "./monte-carlo";
import { RUBRIC } from "./rubric";

/** One judge's score for one submission, the same mark on every criterion. */
function flat(judge: string, sub: string, mark: number): ScoreRow {
  return {
    judge_id: judge,
    submission_id: sub,
    ...Object.fromEntries(RUBRIC.map((c) => [c.key, mark])),
  } as ScoreRow;
}

const subs = (...ids: string[]) => ids.map((id) => ({ id, project_name: id }));

// A harsh judge (H) and a generous one (G) who agree on the order of s1–s3.
// s4 is scored only by G, at G's average. s5 only by H, at H's top mark.
const PANEL: ScoreRow[] = [
  flat("H", "s1", 3),
  flat("H", "s2", 2),
  flat("H", "s3", 1),
  flat("H", "s5", 3),
  flat("G", "s1", 5),
  flat("G", "s2", 4),
  flat("G", "s3", 3),
  flat("G", "s4", 4),
];
const PANEL_SUBS = subs("s1", "s2", "s3", "s4", "s5");
const byId = (r: ReturnType<typeof monteCarloTop>) =>
  new Map(r.rankings.map((x) => [x.submission_id, x]));

describe("monteCarloTop", () => {
  it("is reproducible: the same seed gives the same result", () => {
    const a = monteCarloTop(PANEL, PANEL_SUBS, { seed: 42, trials: 200, topN: 2 });
    const b = monteCarloTop(PANEL, PANEL_SUBS, { seed: 42, trials: 200, topN: 2 });
    expect(a).toEqual(b);
    expect(a.seed).toBe(42);
    expect(a.nTrials).toBe(200);
  });

  it("ranks submissions both judges agree on in that order", () => {
    const r = monteCarloTop(PANEL, PANEL_SUBS, { seed: 1, trials: 50 });
    const order = r.rankings.map((x) => x.submission_id);
    expect(order.indexOf("s1")).toBeLessThan(order.indexOf("s2"));
    expect(order.indexOf("s2")).toBeLessThan(order.indexOf("s3"));
  });

  it("normalizes per judge: a harsh judge's top mark beats a generous judge's average", () => {
    const r = byId(monteCarloTop(PANEL, PANEL_SUBS, { seed: 1, trials: 50 }));
    // On raw points s4 (80) is ahead of s5 (60)…
    expect(r.get("s4")!.raw_total).toBeGreaterThan(r.get("s5")!.raw_total);
    // …but s5 was its judge's best and s4 only its judge's average.
    expect(r.get("s5")!.normalized_score).toBeGreaterThan(r.get("s4")!.normalized_score);
    expect(r.get("s4")!.normalized_score).toBeCloseTo(0);
  });

  it("shrinks submissions with few judges toward neutral", () => {
    const none = byId(monteCarloTop(PANEL, PANEL_SUBS, { seed: 1, trials: 10, shrinkageK: 0 }));
    const some = byId(monteCarloTop(PANEL, PANEL_SUBS, { seed: 1, trials: 10, shrinkageK: 3 }));
    // One judge, k = 3: credibility 1 / (1 + 3).
    expect(some.get("s5")!.normalized_score).toBeCloseTo(none.get("s5")!.normalized_score / 4);
    // Two judges, k = 3: credibility 2 / (2 + 3).
    expect(some.get("s1")!.normalized_score).toBeCloseTo(none.get("s1")!.normalized_score * 0.4);
  });

  it("reports raw totals out of 100 and how many judges scored", () => {
    const r = byId(monteCarloTop(PANEL, PANEL_SUBS, { seed: 1, trials: 10 }));
    expect(r.get("s1")!.n_judges).toBe(2);
    expect(r.get("s1")!.raw_total).toBeCloseTo(80); // mean of 60 and 100
    expect(r.get("s5")!.n_judges).toBe(1);
  });

  it("fills exactly topN places in every trial", () => {
    const topN = 2;
    const r = monteCarloTop(PANEL, PANEL_SUBS, { seed: 7, trials: 300, topN });
    const total = r.rankings.reduce((t, x) => t + x.p_top_n, 0);
    expect(total).toBeCloseTo(topN);
    for (const x of r.rankings) {
      expect(x.p_top_n).toBeGreaterThanOrEqual(0);
      expect(x.p_top_n).toBeLessThanOrEqual(1);
    }
  });

  it("never auto-locks more than topN, and keeps locked and bubble apart", () => {
    const r = monteCarloTop(PANEL, PANEL_SUBS, { seed: 7, trials: 300, topN: 2 });
    expect(r.autoLocked.length).toBeLessThanOrEqual(2);
    for (const id of r.bubble) expect(r.autoLocked).not.toContain(id);
  });

  it("lists a submission nobody scored, with no chance of placing", () => {
    const r = byId(
      monteCarloTop(PANEL, [...PANEL_SUBS, { id: "unscored", project_name: "unscored" }], {
        seed: 1,
        trials: 50,
        topN: 2,
      }),
    );
    expect(r.get("unscored")).toMatchObject({ n_judges: 0, p_top_n: 0, raw_total: 0 });
  });

  it("orders level scores by Impact, then Innovation", () => {
    const row = (sub: string, impact: number, innovation: number): ScoreRow => ({
      ...flat("J", sub, 3),
      impact,
      innovation,
    });
    // a and b swap Impact and Innovation, which carry the same weight, so
    // their composite scores are level.
    const r = monteCarloTop([row("b", 3, 5), row("a", 5, 3)], subs("b", "a"), {
      seed: 1,
      trials: 10,
    });
    expect(r.rankings[0].normalized_score).toBeCloseTo(r.rankings[1].normalized_score);
    expect(r.rankings.map((x) => x.submission_id)).toEqual(["a", "b"]);
    // Impact separates them, so the panel isn't asked to vote.
    expect(r.ties).toEqual([]);
  });

  it("flags a tie the tie-breakers can't settle", () => {
    const r = monteCarloTop(
      [flat("J", "a", 4), flat("J", "b", 4), flat("J", "c", 1)],
      subs("a", "b", "c"),
      { seed: 1, trials: 10 },
    );
    expect(r.ties).toHaveLength(1);
    expect([...r.ties[0]].sort()).toEqual(["a", "b"]);
  });

  it("copes with a judge who gives everything the same mark", () => {
    const r = monteCarloTop([flat("J", "a", 5), flat("J", "b", 5)], subs("a", "b"), {
      seed: 1,
      trials: 20,
    });
    for (const x of r.rankings) expect(Number.isFinite(x.normalized_score)).toBe(true);
  });

  it("returns empty results when there are no scores", () => {
    const r = monteCarloTop([], subs("a"), { seed: 1, trials: 5 });
    expect(r.autoLocked).toEqual([]);
    expect(r.bubble).toEqual([]);
    expect(r.rankings).toHaveLength(1);
  });
});

describe("drawBubble", () => {
  const rankings = monteCarloTop(PANEL, PANEL_SUBS, { seed: 3, trials: 100, topN: 2 }).rankings;
  const pool = ["s1", "s2", "s3", "s4", "s5"];

  it("is reproducible for a given seed", () => {
    expect(drawBubble(pool, rankings, 3, 99)).toEqual(drawBubble(pool, rankings, 3, 99));
  });

  it("draws the number of slots asked for, without repeats, from the bubble", () => {
    const picked = drawBubble(pool, rankings, 3, 5);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    for (const id of picked) expect(pool).toContain(id);
  });

  it("draws everyone when there are more slots than candidates", () => {
    expect(drawBubble(["s1", "s2"], rankings, 5, 5).sort()).toEqual(["s1", "s2"]);
  });

  it("draws nothing when there are no slots or no candidates", () => {
    expect(drawBubble(pool, rankings, 0, 5)).toEqual([]);
    expect(drawBubble([], rankings, 2, 5)).toEqual([]);
  });
});
