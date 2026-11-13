// Who may do what. These rules used to live in the database as row-level
// security policies; they now live here, as plain functions with tests, and
// every function in src/server that reads or writes on someone's behalf
// checks them.
//
// Keep this file free of database and framework imports so the rules stay
// easy to read and to test.

import { canWrite, type AdminRole } from "@/lib/admin-roles";
import type { Phase } from "./event";

/** Whoever is making the request. */
export type Viewer =
  | { kind: "public" }
  | { kind: "judge"; judgeId: string; role: "judge" | "mentor" }
  | { kind: "admin"; role: AdminRole };

export const PUBLIC: Viewer = { kind: "public" };

type Switches = {
  phase: Phase;
  submissions_open: boolean;
  registration_open: boolean;
  /** Present on a real event; left out in simple tests, meaning "all on". */
  settings?: { features: { registration: boolean; mentors: boolean } };
};

/**
 * Participant registration: the admin switch, only before judging, and only
 * if the event uses registration at all.
 */
export function registrationAccepting(e: Switches): boolean {
  return (
    e.phase === "submissions" && e.registration_open && (e.settings?.features.registration ?? true)
  );
}

/**
 * Mentor sign-up: the same admin switch and phase, and only if the event has
 * a mentor programme.
 */
export function mentorSignupAccepting(e: Switches): boolean {
  return e.phase === "submissions" && e.registration_open && (e.settings?.features.mentors ?? true);
}

/** New submissions and edits: the admin switch, and only before judging. */
export function submissionsAccepting(e: Switches): boolean {
  return e.phase === "submissions" && e.submissions_open;
}

/** Judges and mentors are kept out until an organizer opens judging. */
export function canSeeSubmissions(v: Viewer, phase: Phase): boolean {
  if (v.kind === "admin") return true;
  if (v.kind === "judge") return phase === "judging" || phase === "results";
  return false;
}

/**
 * Judges see only submissions that are complete and not hidden.
 * Admins see everything.
 */
export function canSeeThisSubmission(
  v: Viewer,
  phase: Phase,
  s: { hidden_from_judges: boolean; is_submission_complete: boolean },
): boolean {
  if (!canSeeSubmissions(v, phase)) return false;
  if (v.kind === "admin") return true;
  return !s.hidden_from_judges && s.is_submission_complete;
}

/** Only judges score, and only while judging is open. Mentors never do. */
export function canScore(v: Viewer, phase: Phase): boolean {
  return v.kind === "judge" && v.role === "judge" && phase === "judging";
}

/**
 * Declaring or withdrawing a conflict follows the same rule as scoring, and
 * an event can turn conflict declarations off.
 */
export function canRecuse(v: Viewer, phase: Phase, recusalsOn = true): boolean {
  return recusalsOn && canScore(v, phase);
}

/**
 * Panel-wide averages and the final ranking. Admins can preview them at any
 * time; judges and mentors only once results are open; the public only once
 * results are open and the event has chosen to publish them.
 */
export function canSeeResults(v: Viewer, phase: Phase, publicResults = false): boolean {
  if (v.kind === "admin") return true;
  if (v.kind === "judge") return phase === "results";
  // Everyone else: only the final ranking, and only if the event publishes it.
  return publicResults && phase === "results";
}

/**
 * Other judges' evidence sentences, shown without names or scores. For
 * judges, mentors and admins; never the public, even with public results.
 */
export function canSeeJudgeNotes(v: Viewer, phase: Phase): boolean {
  return v.kind !== "public" && canSeeResults(v, phase);
}

/**
 * One judge's individual scores for a submission. Only that judge.
 * Not other judges, not mentors. Admins read raw scores through the admin
 * panel's own functions, never through a judge-facing one.
 */
export function canSeeScoresOf(v: Viewer, judgeId: string): boolean {
  return v.kind === "judge" && v.role === "judge" && v.judgeId === judgeId;
}

/** Registrations hold personal details: admins only. */
export function canSeeRegistrations(v: Viewer): boolean {
  return v.kind === "admin";
}

/** Anything that changes event data from the admin panel. */
export function canAdminWrite(v: Viewer): boolean {
  return v.kind === "admin" && canWrite(v.role);
}

export class NotAllowed extends Error {
  constructor(message = "You're not allowed to do that.") {
    super(message);
    this.name = "NotAllowed";
  }
}
