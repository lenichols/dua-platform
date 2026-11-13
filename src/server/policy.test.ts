import { describe, expect, it } from "vitest";
import type { Phase } from "./event";
import {
  PUBLIC,
  canAdminWrite,
  canRecuse,
  canScore,
  canSeeJudgeNotes,
  canSeeRegistrations,
  canSeeResults,
  canSeeScoresOf,
  canSeeSubmissions,
  canSeeThisSubmission,
  registrationAccepting,
  submissionsAccepting,
  type Viewer,
} from "./policy";

const judge: Viewer = { kind: "judge", judgeId: "j1", role: "judge" };
const mentor: Viewer = { kind: "judge", judgeId: "m1", role: "mentor" };
const owner: Viewer = { kind: "admin", role: "owner" };
const admin: Viewer = { kind: "admin", role: "admin" };
const readOnly: Viewer = { kind: "admin", role: "viewer" };
const PHASES: Phase[] = ["submissions", "judging", "results"];

describe("public forms", () => {
  const state = (phase: Phase, open: boolean) => ({
    phase,
    submissions_open: open,
    registration_open: open,
  });

  it("accept only while the switch is on and the event is in the submissions phase", () => {
    expect(registrationAccepting(state("submissions", true))).toBe(true);
    expect(submissionsAccepting(state("submissions", true))).toBe(true);
    for (const phase of PHASES) {
      expect(registrationAccepting(state(phase, false))).toBe(false);
      expect(submissionsAccepting(state(phase, false))).toBe(false);
    }
    for (const phase of ["judging", "results"] as Phase[]) {
      expect(registrationAccepting(state(phase, true))).toBe(false);
      expect(submissionsAccepting(state(phase, true))).toBe(false);
    }
  });

  it("have separate switches", () => {
    const s = { phase: "submissions" as Phase, submissions_open: true, registration_open: false };
    expect(submissionsAccepting(s)).toBe(true);
    expect(registrationAccepting(s)).toBe(false);
  });
});

describe("seeing submissions", () => {
  it("keeps judges and mentors out until judging opens", () => {
    for (const v of [judge, mentor]) {
      expect(canSeeSubmissions(v, "submissions")).toBe(false);
      expect(canSeeSubmissions(v, "judging")).toBe(true);
      expect(canSeeSubmissions(v, "results")).toBe(true);
    }
  });

  it("lets admins in at any time and the public never", () => {
    for (const phase of PHASES) {
      expect(canSeeSubmissions(readOnly, phase)).toBe(true);
      expect(canSeeSubmissions(PUBLIC, phase)).toBe(false);
    }
  });

  it("hides hidden and incomplete submissions from judges but not admins", () => {
    const hidden = { hidden_from_judges: true, is_submission_complete: true };
    const incomplete = { hidden_from_judges: false, is_submission_complete: false };
    const fine = { hidden_from_judges: false, is_submission_complete: true };
    expect(canSeeThisSubmission(judge, "judging", fine)).toBe(true);
    expect(canSeeThisSubmission(judge, "judging", hidden)).toBe(false);
    expect(canSeeThisSubmission(mentor, "judging", incomplete)).toBe(false);
    expect(canSeeThisSubmission(admin, "judging", hidden)).toBe(true);
    expect(canSeeThisSubmission(judge, "submissions", fine)).toBe(false);
    expect(canSeeThisSubmission(PUBLIC, "judging", fine)).toBe(false);
  });
});

describe("scoring", () => {
  it("is for judges only, and only during judging", () => {
    expect(canScore(judge, "judging")).toBe(true);
    expect(canScore(judge, "submissions")).toBe(false);
    expect(canScore(judge, "results")).toBe(false);
  });

  it("is never open to mentors, admins or the public", () => {
    for (const phase of PHASES) {
      for (const v of [mentor, owner, admin, readOnly, PUBLIC]) {
        expect(canScore(v, phase)).toBe(false);
        expect(canRecuse(v, phase)).toBe(false);
      }
    }
  });

  it("lets a judge recuse exactly when they could score", () => {
    for (const phase of PHASES) expect(canRecuse(judge, phase)).toBe(canScore(judge, phase));
  });
});

describe("individual scores", () => {
  it("are visible only to the judge who gave them", () => {
    expect(canSeeScoresOf(judge, "j1")).toBe(true);
    expect(canSeeScoresOf(judge, "j2")).toBe(false);
    expect(canSeeScoresOf(mentor, "m1")).toBe(false);
    expect(canSeeScoresOf(mentor, "j1")).toBe(false);
    expect(canSeeScoresOf(owner, "j1")).toBe(false);
    expect(canSeeScoresOf(PUBLIC, "j1")).toBe(false);
  });
});

describe("results and judges' notes", () => {
  it("open to judges and mentors only in the results phase", () => {
    for (const v of [judge, mentor]) {
      expect(canSeeResults(v, "submissions")).toBe(false);
      expect(canSeeResults(v, "judging")).toBe(false);
      expect(canSeeResults(v, "results")).toBe(true);
      expect(canSeeJudgeNotes(v, "judging")).toBe(false);
      expect(canSeeJudgeNotes(v, "results")).toBe(true);
    }
  });

  it("can be previewed by admins and are never public", () => {
    for (const phase of PHASES) {
      expect(canSeeResults(readOnly, phase)).toBe(true);
      expect(canSeeJudgeNotes(readOnly, phase)).toBe(true);
      expect(canSeeResults(PUBLIC, phase)).toBe(false);
      expect(canSeeJudgeNotes(PUBLIC, phase)).toBe(false);
    }
  });
});

describe("admin panel", () => {
  it("shows registrations to admins of any role and to nobody else", () => {
    for (const v of [owner, admin, readOnly]) expect(canSeeRegistrations(v)).toBe(true);
    for (const v of [judge, mentor, PUBLIC]) expect(canSeeRegistrations(v)).toBe(false);
  });

  it("lets owners and admins write, and keeps viewers read-only", () => {
    expect(canAdminWrite(owner)).toBe(true);
    expect(canAdminWrite(admin)).toBe(true);
    expect(canAdminWrite(readOnly)).toBe(false);
    for (const v of [judge, mentor, PUBLIC]) expect(canAdminWrite(v)).toBe(false);
  });
});
