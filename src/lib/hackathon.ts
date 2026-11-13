// Shared option lists for the event, used by both the project submission form
// (/submit) and the public registration form (/register) so they stay in sync.
// These describe the sample event in src/lib/site.ts; replace them with your own.

export const TRACKS = [
  "New Technologies & Hardware Innovations",
  "Digital Solutions, Apps & AI/ML Tools",
  "Business Models & Financing Approaches",
  "Clean Energy & Sustainability Solutions",
  "Policy, Systems & Community-Based Solutions",
];

// Problem briefs teams can pick from, or they bring their own problem.
// Stored on submissions.problem_brief as shown here.
export const OWN_PROBLEM = "Own problem (not one of the briefs)";

export const PROBLEM_BRIEFS = [
  "1 · Cold storage for clinics without reliable power",
  "2 · Forecast demand before building a mini-grid",
  "3 · Lower energy bills for renters",
  "4 · Keep a neighbourhood running through an outage",
  OWN_PROBLEM,
];

export const EXPERIENCE_LEVELS = [
  "Student",
  "First-time hacker",
  "Early career (0–2 yrs)",
  "Mid-level (3–7 yrs)",
  "Senior (8+ yrs)",
  "Energy industry professional",
];

// Experience bands for mentor sign-ups (participant levels don't fit —
// "First-time hacker" isn't a mentor profile).
export const MENTOR_EXPERIENCE_LEVELS = [
  "Mid-level (3–7 yrs)",
  "Senior (8–14 yrs)",
  "Executive / 15+ yrs",
  "Energy industry professional",
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
