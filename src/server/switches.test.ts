import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { registrations } from "@/db/schema";
import type { EventSettings } from "@/lib/event-settings";
import {
  ADMIN,
  inPhase,
  makeEvent,
  makeJudge,
  makeSubmission,
  resetDb,
  scoreOf,
} from "../../test/fixtures";
import {
  IDENTIFYING_COLUMNS,
  declareConflict,
  getResultsLock,
  getSubmissionForViewer,
  listJudgeNotes,
  listSubmissionsForJudging,
  rubricAggregates,
  saveScore,
} from "./judging";
import {
  NotAllowed,
  PUBLIC,
  canRecuse,
  canSeeJudgeNotes,
  canSeeResults,
  mentorSignupAccepting,
  registrationAccepting,
  type Viewer,
} from "./policy";
import { createRegistration } from "./registrations";
import { computeAndLockResults } from "./results";

beforeEach(resetDb);

const judging = (over: Partial<EventSettings["judging"]>) => ({
  judging: { anonymous: false, requireEvidence: true, ranking: "normalized" as const, recusals: true, publicResults: false, ...over },
});
const features = (over: Partial<EventSettings["features"]>) => ({
  features: { mentors: true, registration: true, emailCampaigns: true, howItWorks: true, ...over },
});
const person = { full_name: "Sam Example", email: "sam@example.org", country: "Canada" };
const judge: Viewer = { kind: "judge", judgeId: "j", role: "judge" };

describe("feature switches", () => {
  it("close registration for good when the event doesn't use it", async () => {
    const event = await makeEvent({ registration_open: true, settings: features({ registration: false }) });
    expect(registrationAccepting(event)).toBe(false);
    expect(await createRegistration(event, "participant", person)).toEqual({ ok: false, reason: "closed" });
    // Mentor sign-up is a separate switch and still works.
    expect(mentorSignupAccepting(event)).toBe(true);
    expect((await createRegistration(event, "mentor", person)).ok).toBe(true);
  });

  it("close mentor sign-up when there's no mentor programme", async () => {
    const event = await makeEvent({ registration_open: true, settings: features({ mentors: false }) });
    expect(mentorSignupAccepting(event)).toBe(false);
    expect(await createRegistration(event, "mentor", person)).toEqual({ ok: false, reason: "closed" });
    expect((await createRegistration(event, "participant", person)).ok).toBe(true);
  });

  it("store a solo-or-team answer that wasn't asked as empty, not as a blank choice", async () => {
    const event = await makeEvent({ registration_open: true });
    expect((await createRegistration(event, "participant", { ...person, participating_as: "" })).ok).toBe(true);
    const [row] = await db().select().from(registrations);
    expect(row.participating_as).toBeNull();
  });
});

describe("anonymous judging", () => {
  it("hides who made a project from judges and mentors, but not from admins", async () => {
    const event = await makeEvent({ phase: "judging", settings: judging({ anonymous: true }) });
    const sub = await makeSubmission(event, { mentor_name: "Morgan Example", member3_name: "Robin Example" });
    const j = await makeJudge(event);
    const m = await makeJudge(event, "mentor");

    for (const viewer of [j.viewer, m.viewer]) {
      const seen = (await getSubmissionForViewer(event, viewer, sub))!;
      for (const c of IDENTIFYING_COLUMNS) expect(seen[c]).toBeNull();
      const text = JSON.stringify(seen);
      for (const name of ["Ada Example", "Grace Example", "Robin Example", "Morgan Example", "Team "]) {
        expect(text).not.toContain(name);
      }
      expect(seen.project_name).toBeTruthy();
      const [listed] = await listSubmissionsForJudging(event, viewer);
      expect(listed.team_name).toBeNull();
    }
    const admin = (await getSubmissionForViewer(event, ADMIN, sub))!;
    expect(admin.member1_name).toBe("Ada Example");
    expect(admin.team_name).toMatch(/^Team /);
  });

  it("is off unless the event turns it on", async () => {
    const event = await makeEvent({ phase: "judging" });
    const sub = await makeSubmission(event);
    const j = await makeJudge(event);
    expect((await getSubmissionForViewer(event, j.viewer, sub))!.member1_name).toBe("Ada Example");
  });
});

describe("evidence", () => {
  const marksOnly = { marks: scoreOf(4).marks, evidence: {} };

  it("is required by default", async () => {
    const event = await makeEvent({ phase: "judging" });
    const sub = await makeSubmission(event);
    const j = await makeJudge(event);
    expect((await saveScore(event, j.viewer, sub, marksOnly)).ok).toBe(false);
  });

  it("can be made optional, and is still kept when given", async () => {
    const event = await makeEvent({ phase: "judging", settings: judging({ requireEvidence: false }) });
    const a = await makeSubmission(event);
    const b = await makeSubmission(event);
    const j = await makeJudge(event);
    expect(await saveScore(event, j.viewer, a, marksOnly)).toEqual({ ok: true });
    expect(await saveScore(event, j.viewer, b, scoreOf(4))).toEqual({ ok: true });
    const notes = await listJudgeNotes(event, ADMIN, b);
    expect(notes[0].lines).toHaveLength(5);
    expect((await listJudgeNotes(event, ADMIN, a))[0].lines).toEqual([]);
    // Marks are still checked.
    expect((await saveScore(event, j.viewer, a, { marks: { ...marksOnly.marks, impact: 9 }, evidence: {} })).ok).toBe(false);
  });
});

describe("conflict declarations", () => {
  it("can be turned off", async () => {
    const event = await makeEvent({ phase: "judging", settings: judging({ recusals: false }) });
    const sub = await makeSubmission(event);
    const j = await makeJudge(event);
    expect(canRecuse(judge, "judging", false)).toBe(false);
    expect(canRecuse(judge, "judging")).toBe(true);
    const r = await declareConflict(event, j.viewer, sub, "I know them");
    expect(r.ok).toBe(false);
    expect((await saveScore(event, j.viewer, sub, scoreOf(4))).ok).toBe(true);
  });
});

describe("ranking by plain average", () => {
  it("orders by average total and marks every place as certain", async () => {
    const event = await makeEvent({ phase: "judging", settings: { ...judging({ ranking: "average" }), topN: 2 } });
    const low = await makeSubmission(event);
    const high = await makeSubmission(event);
    const mid = await makeSubmission(event);
    const a = await makeJudge(event);
    const b = await makeJudge(event);
    await saveScore(event, a.viewer, low, scoreOf(2));
    await saveScore(event, a.viewer, high, scoreOf(5));
    await saveScore(event, b.viewer, high, scoreOf(4));
    await saveScore(event, a.viewer, mid, scoreOf(3));

    const { top6 } = await computeAndLockResults(event, 1);
    expect(top6.map((t) => t.submission_id)).toEqual([high, mid]);
    expect(top6.map((t) => t.probability)).toEqual([1, 1]);
    // The seed plays no part: a different one gives the same ranking.
    expect((await computeAndLockResults(event, 999)).top6).toEqual(top6);
  });
});

describe("public results", () => {
  async function finished(publicResults: boolean) {
    const event = await makeEvent({ phase: "judging", settings: { ...judging({ publicResults }), topN: 1 } });
    const winner = await makeSubmission(event);
    const other = await makeSubmission(event);
    const j = await makeJudge(event);
    await saveScore(event, j.viewer, winner, scoreOf(5));
    await saveScore(event, j.viewer, other, scoreOf(2));
    await computeAndLockResults(event, 3);
    return { event: inPhase(event, "results"), winner, other };
  }

  it("stay private unless the event publishes them", async () => {
    const { event } = await finished(false);
    expect(canSeeResults(PUBLIC, "results")).toBe(false);
    await expect(rubricAggregates(event, PUBLIC)).rejects.toBeInstanceOf(NotAllowed);
    expect(await getResultsLock(event, PUBLIC)).toBeNull();
  });

  it("show the public only the placed projects, and only once results are open", async () => {
    const { event, winner, other } = await finished(true);
    await expect(rubricAggregates(inPhase(event, "judging"), PUBLIC)).rejects.toBeInstanceOf(NotAllowed);

    const rows = await rubricAggregates(event, PUBLIC);
    expect(rows.map((r) => r.submission_id)).toEqual([winner]);
    expect(rows.map((r) => r.submission_id)).not.toContain(other);
    expect((await getResultsLock(event, PUBLIC))?.top6).toHaveLength(1);
    // Judges still see the whole table.
    const j = await makeJudge(event);
    expect(await rubricAggregates(event, j.viewer)).toHaveLength(2);
  });

  it("never show the public judges' notes or contact details", async () => {
    const { event, winner } = await finished(true);
    expect(canSeeJudgeNotes(PUBLIC, "results")).toBe(false);
    expect(await listJudgeNotes(event, PUBLIC, winner)).toEqual([]);
    expect(await getSubmissionForViewer(event, PUBLIC, winner)).toBeNull();
    expect(JSON.stringify(await rubricAggregates(event, PUBLIC))).not.toContain("@example.org");
  });
});
