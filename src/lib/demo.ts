// Demo mode: for trying Dua out, or running a public sample. When
// DEMO_MODE=true, `npm run db:seed` creates sample accounts with the fixed
// logins below, and the sign-in pages show them.
//
// Never turn this on for a real event: these logins are public.
//
// Keep the values in step with scripts/demo-data.mjs.

export function demoMode(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true";
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
