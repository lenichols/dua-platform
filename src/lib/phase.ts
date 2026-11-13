import { getCurrentEvent, type Phase } from "@/server/event";

export type { Phase };

// These helpers are for pages that should still render if the database is
// unreachable: they fall back to the most closed-down answer.

export async function getPhase(): Promise<Phase> {
  try {
    return (await getCurrentEvent()).phase;
  } catch {
    return "submissions";
  }
}

// Whether the project submission form is open. Admin-controlled, separate from
// phase; defaults to false (closed) so /submit stays locked until opened.
export async function getSubmissionsOpen(): Promise<boolean> {
  try {
    return (await getCurrentEvent()).submissions_open;
  } catch {
    return false;
  }
}

// Whether participant registration and mentor sign-up are open.
// Admin-controlled, like submissions_open; both forms also close once the
// phase leaves "submissions". Defaults to false (closed).
export async function getRegistrationOpen(): Promise<boolean> {
  try {
    return (await getCurrentEvent()).registration_open;
  } catch {
    return false;
  }
}
