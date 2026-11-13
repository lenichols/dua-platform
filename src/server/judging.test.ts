import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { recusals, scores, submissions } from "@/db/schema";
import { DEFAULT_RUBRIC } from "@/lib/event-settings";
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
  getAnswersForViewer,
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
    expect((await getOwnScore(event, viewer, visible))?.marks.impact).toBe(5);
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
    const good = scoreOf(4);
    const withMark = (impact: unknown) => ({ ...good, marks: { ...good.marks, impact } });
    for (const bad of [6, 0, 3.5, "four", null]) {
      expect((await saveScore(event, viewer, visible, withMark(bad))).ok).toBe(false);
    }
    expect(
      (await saveScore(event, viewer, visible, { ...good, evidence: { ...good.evidence, impact: "ok" } })).ok,
    ).toBe(false);
    const { feasibility: _dropped, ...partial } = good.marks;
    expect((await saveScore(event, viewer, visible, { ...good, marks: partial })).ok).toBe(false);
    expect((await saveScore(event, viewer, visible, null)).ok).toBe(false);
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
    expect(row.averages.impact).toBe(4);
    expect(Object.keys(row.averages)).toEqual(DEFAULT_RUBRIC.criteria.map((c) => c.key));
    const five = Object.fromEntries(["impact", "innovation", "sustainability", "feasibility", "scalability"].map((k) => [k, 5]));
    const three = Object.fromEntries(Object.keys(five).map((k) => [k, 3]));
    expect(row.avg_total).toBeCloseTo((totalScore(DEFAULT_RUBRIC, five) + totalScore(DEFAULT_RUBRIC, three)) / 2);
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
    expect(text).not.toMatch(/"(marks|impact|innovation|sustainability|feasibility|scalability)":/);
  });

  it("lock a ranking that the same seed reproduces, and open the results phase", async () => {
    await twoJudgesScore();
    const first = await computeAndLockResults(event, 42);
    const second = await computeAndLockResults(event, 42);
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
    const { top6 } = await computeAndLockResults(event, 7);
    expect(top6.map((t) => t.submission_id)).not.toContain(later);
  });
});

describe("an event with its own rubric and number of places", () => {
  const rubric = {
    criteria: [
      { key: "craft", label: "Craft", weight: 70, anchors: { limited: "", solid: "", exceptional: "" }, example: "" },
      { key: "story", label: "Story", weight: 30, anchors: { limited: "", solid: "", exceptional: "" }, example: "" },
    ],
    tieBreakers: ["story"],
  };
  const entry = (craft: number, story: number) => ({
    marks: { craft, story },
    evidence: { craft: "The build quality was shown in the demo.", story: "The pitch explained who it is for." },
  });

  it("scores, averages and ranks on that rubric", async () => {
    const custom = await makeEvent({ phase: "judging", settings: { rubric, topN: 1 } });
    const strong = await makeSubmission(custom);
    const weak = await makeSubmission(custom);
    const { viewer } = await makeJudge(custom);

    // A score on the default rubric doesn't fit this event.
    expect((await saveScore(custom, viewer, strong, scoreOf(4))).ok).toBe(false);

    expect(await saveScore(custom, viewer, strong, entry(5, 4))).toEqual({ ok: true });
    expect(await saveScore(custom, viewer, weak, { ...entry(2, 2), marks: { craft: 2, story: 2, impact: 5 } })).toEqual({ ok: true });
    // Marks for criteria that aren't on the rubric are dropped.
    expect((await getOwnScore(custom, viewer, weak))?.marks).toEqual({ craft: 2, story: 2 });

    const rows = await rubricAggregates(custom, ADMIN);
    const top = rows.find((r) => r.submission_id === strong)!;
    expect(top.averages).toEqual({ craft: 5, story: 4 });
    expect(top.avg_total).toBeCloseTo(70 + 24);

    const { top6 } = await computeAndLockResults(custom, 3);
    expect(top6).toHaveLength(1);
    expect(top6[0].submission_id).toBe(strong);

    const notes = await listJudgeNotes(inPhase(custom, "results"), viewer, strong);
    expect(notes[0].lines.map((l) => l.criterion)).toEqual(["Craft", "Story"]);
  });
});

describe("answers to the organizer's own questions", () => {
  const q = (key: string, showToJudges: boolean) => ({
    key,
    label: key,
    type: "text" as const,
    required: false,
    options: [],
    help: "",
    showToJudges,
  });

  it("reach judges only for questions marked for them, and never before judging", async () => {
    const custom = await makeEvent({
      phase: "judging",
      settings: { customFields: { registration: [], submission: [q("stack", true), q("backup_phone", false)] } },
    });
    const sub = await makeSubmission(custom, { custom: { stack: "Rust", backup_phone: "+1 555 0199" } });
    const hiddenSub = await makeSubmission(custom, { hidden_from_judges: true, custom: { stack: "Go" } });
    const judge = await makeJudge(custom);
    const mentor = await makeJudge(custom, "mentor");

    for (const viewer of [judge.viewer, mentor.viewer, ADMIN]) {
      const rows = await getAnswersForViewer(custom, viewer, sub);
      expect(rows.map((r) => [r.key, r.value])).toEqual([["stack", "Rust"]]);
      expect(JSON.stringify(rows)).not.toContain("555 0199");
    }
    expect(await getAnswersForViewer(custom, judge.viewer, hiddenSub)).toEqual([]);
    expect(await getAnswersForViewer(inPhase(custom, "submissions"), judge.viewer, sub)).toEqual([]);
    expect(await getAnswersForViewer(custom, PUBLIC, sub)).toEqual([]);
  });
});
