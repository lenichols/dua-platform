// Demo mode: for trying Dua out, or running a public sample. When
// DEMO_MODE=true, `npm run db:seed` creates sample accounts with the fixed
// logins below, and the sign-in pages show them.
//
// Never turn this on for a real event: these logins are public.
//
// Keep the values in step with scripts/_demo-seed.mjs.

export function demoMode(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true";
}

/**
 * What the sample admin may do. "admin" (the default) can run the event;
 * "viewer" can look at everything and change nothing, which is the safe
 * choice for a demo anyone on the internet can reach.
 */
export function demoAdminRole(): "admin" | "viewer" {
  return process.env.DEMO_ADMIN_ROLE?.trim().toLowerCase() === "viewer" ? "viewer" : "admin";
}

/** Whether an email belongs to one of the sample accounts. */
export function isSampleEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return [DEMO_JUDGE.email, DEMO_MENTOR.email, DEMO_ADMIN.email].includes(e);
}

export type SampleLogin = {
  /** Who this signs you in as, e.g. "Judge". */
  label: string;
  /** One line on what that account can do. */
  can: string;
  email: string;
  password: string;
};

export const DEMO_JUDGE: SampleLogin = {
  label: "Judge",
  can: "Scores projects",
  email: "demo.judge@example.org",
  password: "dua-demo-judge",
};

export const DEMO_MENTOR: SampleLogin = {
  label: "Mentor",
  can: "Reads projects, can't score",
  email: "demo.mentor@example.org",
  password: "dua-demo-mentor",
};

export const DEMO_ADMIN: SampleLogin = {
  label: "Admin",
  can: "Runs the event",
  email: "demo.admin@example.org",
  password: "dua-demo-admin",
};
