// Everything that names the event this deployment runs: who hosts it, when it
// is, how to reach the organizers. Edit this file to make the platform yours.
//
// Safe to import from client components: no secrets and no server-only env.
// The values below describe a made-up sample event.

export const EVENT = {
  /** Full event name, used in page titles, headings and email. */
  name: "Demo Energy Hackathon",
  /** One word of `name` drawn in the accent colour in the wordmark. Optional. */
  accentWord: "Energy",
  /** Short line under the name on the homepage. */
  tagline: "Build something that keeps the lights on.",
  /** One or two sentences for search engines and link previews. */
  description:
    "A sample event running on Dua, the open source hackathon platform: registration, project submission, judging and results in one place.",
  /** Shown as written. */
  dates: "March 5 – 7, 2027",
  /** When the submission form (and edit links) stop working. Shown as written. */
  submissionDeadline: "March 7, 2027 at 12:00 PM ET",
  /** When judges can first sign in. Shown as written. */
  judgingOpens: "March 7, 2027 at 2:00 PM ET",
  format: "100% Virtual · Global",
  prizes: "$5,000 in prizes",
  maxTeamSize: 5,
  host: {
    name: "Example Org",
    url: "https://example.org",
  },
  /** Where participants write when something goes wrong. */
  contactEmail: "hello@example.org",
  /** The page or profile teams tag when they announce their project. */
  announceUrl: "https://example.org/hackathon",
} as const;

/** The platform itself, for the "powered by" credit. */
export const PLATFORM = {
  name: "Dua",
  url: "https://github.com/lenichols/dua-platform",
} as const;
