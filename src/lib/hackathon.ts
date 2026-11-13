// Shared option lists for the event, used by both the project submission form
// (/submit) and the public registration form (/register) so they stay in sync.
// These describe the sample event in src/lib/site.ts; replace them with your own.

export const TRACKS = [
  "Web & Mobile Apps",
  "AI & Data",
  "Hardware & Devices",
  "Developer Tools",
  "Social Good",
];

// Problem briefs teams can pick from, or they bring their own problem.
// Stored on submissions.problem_brief as shown here.
export const OWN_PROBLEM = "Own problem (not one of the briefs)";

export const PROBLEM_BRIEFS = [
  "1 · Help a small nonprofit schedule its volunteers",
  "2 · Make local transit times easier to check",
  "3 · A study tool that still works offline",
  "4 · Cut the time it takes to report a bug well",
  OWN_PROBLEM,
];

export const EXPERIENCE_LEVELS = [
  "Student",
  "First-time hacker",
  "Early career (0–2 yrs)",
  "Mid-level (3–7 yrs)",
  "Senior (8+ yrs)",
];

// Experience bands for mentor sign-ups (participant levels don't fit —
// "First-time hacker" isn't a mentor profile).
export const MENTOR_EXPERIENCE_LEVELS = [
  "Mid-level (3–7 yrs)",
  "Senior (8–14 yrs)",
  "Executive / 15+ yrs",
  "Academic / Researcher",
];

export const HEARD_ABOUT = [
  "LinkedIn",
  "Event website",
  "A partner organization",
  "Friend or colleague",
  "University / school",
  "Newsletter / email",
  "Other social media",
  "Search engine",
];

// Groups the event partners with. Registrants can select any that apply
// (plus a free-text "other"); stored comma-joined.
export const PARTNER_ORGS = [
  "Example Engineering Society",
  "Example Student Network",
  "Example Founders Community",
];
