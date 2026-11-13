import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { recusals, scores, submissions } from "@/db/schema";
import { totalScore } from "@/lib/rubric";
import {
  ADMIN,
  inPhase,
  makeEvent,
  makeJudge,
  makeSubmission,
  resetDb,
  scoreOf,
} from "../../test/fixtures";
import type { EventRow } from "./event";
import {
  JUDGE_VISIBLE_COLUMNS,
  declareConflict,
  getOwnProgress,
  getOwnRecusal,
  getOwnScore,
  getResultsLock,
  getSubmissionForViewer,
  listJudgeNotes,
  listSubmissionsForJudging,
  rubricAggregates,
  saveScore,
  withdrawConflict,
} from "./judging";
import { NotAllowed, PUBLIC } from "./policy";
import { computeAndLockResults } from "./results";

let event: EventRow;
let visible: string;
let hidden: string;
let incomplete: string;

beforeEach(async () => {
  await resetDb();
  event = await makeEvent({ phase: "judging" });
  visible = await makeSubmission(event);
  hidden = await makeSubmission(event, { hidden_from_judges: true });
  incomplete = await makeSubmission(event, { is_submission_complete: false });
});

const scoreCount = async () => (await db().select().from(scores)).length;

describe("what judges can see", () => {
  it("lists only complete, unhidden submissions", async () => {
    const { viewer } = await makeJudge(event);
    const list = await listSubmissionsForJudging(event, viewer);
    expect(list.map((s) => s.id)).toEqual([visible]);
  });

  it("lists nothing before judging opens, and nothing to the public", async () => {
    const { viewer } = await makeJudge(event);
    expect(await listSubmissionsForJudging(inPhase(event, "submissions"), viewer)).toEqual([]);
    expect(await listSubmissionsForJudging(event, PUBLIC)).toEqual([]);
  });

  it("never includes contact details, for judges, mentors or admins", async () => {
    const judge = await makeJudge(event);
    const mentor = await makeJudge(event, "mentor");
    for (const viewer of [judge.viewer, mentor.viewer, ADMIN]) {
      const sub = await getSubmissionForViewer(event, viewer, visible);
      expect(sub).not.toBeNull();
      const text = JSON.stringify(sub);
      expect(text).not.toContain("@example.org");
      expect(text).not.toContain("555 0100");
      expect(text).not.toContain("Springfield");
      expect(text).not.toContain("example.org/in/");
      expect(Object.keys(sub!).sort()).toEqual([...JUDGE_VISIBLE_COLUMNS].sort());
    }
  });

  it("has no contact column on the judge-visible list", () => {
    const contact = /email|phone|city|state_region|occupation|affiliated_org|submitter_|mentor_linkedin|member\d_(linkedin|country)/;
    expect(JUDGE_VISIBLE_COLUMNS.filter((c) => contact.test(c))).toEqual([]);
  });

  it("hides hidden and incomplete submissions from judges but not from admins", async () => {
    const { viewer } = await makeJudge(event);
    expect(await getSubmissionForViewer(event, viewer, hidden)).toBeNull();
    expect(await getSubmissionForViewer(event, viewer, incomplete)).toBeNull();
    expect(await getSubmissionForViewer(event, ADMIN, hidden)).not.toBeNull();
  });

  it("shows nothing to the public, and nothing to judges before judging", async () => {
    const { viewer } = await makeJudge(event);
    expect(await getSubmissionForViewer(event, PUBLIC, visible)).toBeNull();
    expect(await getSubmissionForViewer(inPhase(event, "submissions"), viewer, visible)).toBeNull();
  });

  it("treats a malformed id as not found", async () => {
    const { viewer } = await makeJudge(event);
    expect(await getSubmissionForViewer(event, viewer, "not-an-id")).toBeNull();
  });

  it("can't reach another event's submission", async () => {
    const other = await makeEvent({ phase: "judging" });
    const theirs = await makeSubmission(other);
    const { viewer } = await makeJudge(event);
    expect(await getSubmissionForViewer(event, viewer, theirs)).toBeNull();
    expect((await saveScore(event, viewer, theirs, scoreOf(4))).ok).toBe(false);
  });
});

describe("saving a score", () => {
  it("works for a judge during judging, and a second save replaces the first", async () => {
    const { viewer } = await makeJudge(event);
    expect(await saveScore(event, viewer, visible, scoreOf(3))).toEqual({ ok: true });
    expect(await saveScore(event, viewer, visible, scoreOf(5))).toEqual({ ok: true });
    expect(await scoreCount()).toBe(1);
    expect((await getOwnScore(event, viewer, visible))?.impact).toBe(5);
  });

  it("is refused for mentors, admins and the public", async () => {
    const mentor = await makeJudge(event, "mentor");
    for (const viewer of [mentor.viewer, ADMIN, PUBLIC]) {
      expect((await saveScore(event, viewer, visible, scoreOf(4))).ok).toBe(false);
    }
    expect(await scoreCount()).toBe(0);
  });

  it("is refused before judging opens and after it closes", async () => {
    const { viewer } = await makeJudge(event);
    for (const phase of ["submissions", "results"] as const) {
      expect((await saveScore(inPhase(event, phase), viewer, visible, scoreOf(4))).ok).toBe(false);
    }
    expect(await scoreCount()).toBe(0);
  });

  it("is refused for hidden or incomplete submissions", async () => {
    const { viewer } = await makeJudge(event);
    expect((await saveScore(event, viewer, hidden, scoreOf(4))).ok).toBe(false);
    expect((await saveScore(event, viewer, incomplete, scoreOf(4))).ok).toBe(false);
    expect(await scoreCount()).toBe(0);
  });

  it("is refused when a mark is out of range or evidence is missing", async () => {
    const { viewer } = await makeJudge(event);
    expect((await saveScore(event, viewer, visible, { ...scoreOf(4), impact: 6 })).ok).toBe(false);
    expect((await saveScore(event, viewer, visible, { ...scoreOf(4), impact: 0 })).ok).toBe(false);
    expect((await saveScore(event, viewer, visible, { ...scoreOf(4), impact: 3.5 })).ok).toBe(false);
    expect(
      (await saveScore(event, viewer, visible, { ...scoreOf(4), impact_evidence: "ok" })).ok,
    ).toBe(false);
    const { feasibility: _dropped, ...partial } = scoreOf(4);
    expect((await saveScore(event, viewer, visible, partial)).ok).toBe(false);
    expect(await scoreCount()).toBe(0);
  });

  it("always records the signed-in judge, whatever the request claims", async () => {
    const a = await makeJudge(event);
    const b = await makeJudge(event);
    await saveScore(event, a.viewer, visible, { ...scoreOf(4), judge_id: b.id });
    const [row] = await db().select().from(scores);
    expect(row.judge_id).toBe(a.id);
  });
});

describe("a judge's own scores", () => {
  it("can't be read by another judge or a mentor", async () => {
    const a = await makeJudge(event);
    const b = await makeJudge(event);
    const mentor = await makeJudge(event, "mentor");
    await saveScore(event, a.viewer, visible, scoreOf(5));
    expect(await getOwnScore(event, a.viewer, visible)).not.toBeNull();
    expect(await getOwnScore(event, b.viewer, visible)).toBeNull();
    expect(await getOwnScore(event, mentor.viewer, visible)).toBeNull();
    expect(await getOwnScore(event, ADMIN, visible)).toBeNull();
    expect(await getOwnScore(event, PUBLIC, visible)).toBeNull();
  });

  it("drive that judge's progress and nobody else's", async () => {
    const a = await makeJudge(event);
    const b = await makeJudge(event);
    await saveScore(event, a.viewer, visible, scoreOf(5));
    expect((await getOwnProgress(event, a.viewer)).scoredIds).toEqual([visible]);
    expect((await getOwnProgress(event, b.viewer)).scoredIds).toEqual([]);
  });
});

describe("conflicts of interest", () => {
  it("remove the judge's score and block a new one until withdrawn", async () => {
    const { viewer } = await makeJudge(event);
    await saveScore(event, viewer, visible, scoreOf(5));
    expect(await declareConflict(event, viewer, visible, "I mentored this team")).toEqual({ ok: true });
    expect(await scoreCount()).toBe(0);
    expect((await getOwnRecusal(event, viewer, visible))?.reason).toBe("I mentored this team");
    expect((await saveScore(event, viewer, visible, scoreOf(5))).ok).toBe(false);

    expect(await withdrawConflict(event, viewer, visible)).toEqual({ ok: true });
    expect((await saveScore(event, viewer, visible, scoreOf(5))).ok).toBe(true);
  });

  it("leave other judges' scores alone", async () => {
    const a = await makeJudge(event);
    const b = await makeJudge(event);
    await saveScore(event, a.viewer, visible, scoreOf(5));
    await saveScore(event, b.viewer, visible, scoreOf(3));
    await declareConflict(event, a.viewer, visible, "");
    const left = await db().select().from(scores);
    expect(left.map((s) => s.judge_id)).toEqual([b.id]);
  });

  it("can't be declared by mentors, admins, or outside judging", async () => {
    const judge = await makeJudge(event);
    const mentor = await makeJudge(event, "mentor");
    expect((await declareConflict(event, mentor.viewer, visible, "")).ok).toBe(false);
    expect((await declareConflict(event, ADMIN, visible, "")).ok).toBe(false);
    expect((await declareConflict(inPhase(event, "results"), judge.viewer, visible, "")).ok).toBe(false);
    expect((await db().select().from(recusals)).length).toBe(0);
  });
});

describe("results", () => {
  async function twoJudgesScore() {
    const a = await makeJudge(event);
    const b = await makeJudge(event);
    await saveScore(event, a.viewer, visible, scoreOf(5));
    await saveScore(event, b.viewer, visible, scoreOf(3));
    return { a, b };
  }

  it("are closed to judges and mentors until the results phase", async () => {
    const { a } = await twoJudgesScore();
    const mentor = await makeJudge(event, "mentor");
    await expect(rubricAggregates(event, a.viewer)).rejects.toBeInstanceOf(NotAllowed);
    await expect(rubricAggregates(event, mentor.viewer)).rejects.toBeInstanceOf(NotAllowed);
    await expect(rubricAggregates(inPhase(event, "results"), PUBLIC)).rejects.toBeInstanceOf(NotAllowed);
    expect(await listJudgeNotes(event, a.viewer, visible)).toEqual([]);
    expect(await getResultsLock(event, a.viewer)).toBeNull();
  });

  it("give panel averages that match the rubric's weights", async () => {
    const { a } = await twoJudgesScore();
    const rows = await rubricAggregates(inPhase(event, "results"), a.viewer);
    const row = rows.find((r) => r.submission_id === visible)!;
    expect(row.n_judges).toBe(2);
    expect(row.avg_impact).toBe(4);
    const five = Object.fromEntries(["impact", "innovation", "sustainability", "feasibility", "scalability"].map((k) => [k, 5]));
    const three = Object.fromEntries(Object.keys(five).map((k) => [k, 3]));
    expect(row.avg_total).toBeCloseTo((totalScore(five) + totalScore(three)) / 2);
    expect(row.avg_total).toBeCloseTo(80);
  });

  it("can be previewed by an admin before the results phase", async () => {
    await twoJudgesScore();
    const rows = await rubricAggregates(event, ADMIN);
    expect(rows.find((r) => r.submission_id === visible)?.n_judges).toBe(2);
  });

  it("share judges' evidence without names or numbers", async () => {
    const { a } = await twoJudgesScore();
    const notes = await listJudgeNotes(inPhase(event, "results"), a.viewer, visible);
    expect(notes.map((n) => n.label)).toEqual(["Judge A", "Judge B"]);
    expect(notes[0].lines).toHaveLength(5);
    const text = JSON.stringify(notes);
    expect(text).not.toContain(a.id);
    expect(text).not.toMatch(/Judge \d/); // fixture judges are named "Judge <n>"
    expect(text).not.toMatch(/"(impact|innovation|sustainability|feasibility|scalability)":/);
  });

  it("lock a ranking that the same seed reproduces, and open the results phase", async () => {
    await twoJudgesScore();
    const first = await computeAndLockResults(event.id, 42);
    const second = await computeAndLockResults(event.id, 42);
    expect(second.top6).toEqual(first.top6);
    expect(first.top6.map((t) => t.submission_id)).toEqual([visible]);

    const { a } = { a: (await makeJudge(event)).viewer };
    const lock = await getResultsLock(inPhase(event, "results"), a);
    expect(lock?.seed).toBe(42);
    expect(lock?.top6).toEqual(first.top6);
  });

  it("leave out a submission hidden after it was scored", async () => {
    const { viewer } = await makeJudge(event);
    const later = await makeSubmission(event);
    await saveScore(event, viewer, visible, scoreOf(3));
    await saveScore(event, viewer, later, scoreOf(5));
    await db().update(submissions).set({ hidden_from_judges: true }).where(eq(submissions.id, later));
    const { top6 } = await computeAndLockResults(event.id, 7);
    expect(top6.map((t) => t.submission_id)).not.toContain(later);
  });
});
