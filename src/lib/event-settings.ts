// Everything about an event that an organizer can change without touching
// code: its name and dates, the option lists on its forms, its homepage copy,
// and how it is judged. Stored per event in the database and edited in the
// admin panel's Event tab.
//
// DEFAULT_SETTINGS describes a made-up sample event. A new event starts from
// it, and any value an organizer hasn't set falls back to it.
//
// Safe to import from client components: no database, no secrets.

import { z } from "zod";

const line = (max = 200) => z.string().trim().max(max);
const required = (max = 200) => z.string().trim().min(1, "This can't be empty").max(max);
const list = (max = 60) =>
  z
    .array(required(160))
    .max(max)
    .transform((items) => [...new Set(items)]);

// ── rubric ───────────────────────────────────────────────────────

/** Every criterion is scored from 1 to this. */
export const SCALE_MAX = 5;

export const criterionSchema = z.object({
  /** Short id stored with each score. Never shown. */
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,30}$/, "Use lowercase letters, numbers and underscores"),
  label: required(60),
  /** Share of the total, as a whole percentage. All weights add up to 100. */
  weight: z.coerce.number().int().min(1).max(100),
  /** What a 1, a 3 and a 5 look like. */
  anchors: z.object({
    limited: line(300),
    solid: line(300),
    exceptional: line(300),
  }),
  /** A sample evidence sentence, shown as the placeholder. */
  example: line(300),
});

export const rubricSchema = z
  .object({
    criteria: z.array(criterionSchema).min(1, "Add at least one criterion").max(10),
    /** Criterion keys, in the order used to settle a tie. */
    tieBreakers: z.array(z.string()).max(10),
  })
  .superRefine((r, ctx) => {
    const keys = r.criteria.map((c) => c.key);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", message: "Each criterion needs its own key", path: ["criteria"] });
    const total = r.criteria.reduce((t, c) => t + c.weight, 0);
    if (total !== 100)
      ctx.addIssue({
        code: "custom",
        message: `Weights must add up to 100 (they add up to ${total})`,
        path: ["criteria"],
      });
    if (r.tieBreakers.some((k) => !keys.includes(k)))
      ctx.addIssue({
        code: "custom",
        message: "Tie-breakers must be criteria on the rubric",
        path: ["tieBreakers"],
      });
  });

export type Criterion = z.infer<typeof criterionSchema>;
export type Rubric = z.infer<typeof rubricSchema>;

// ── questions on the forms ───────────────────────────────────────

export const CUSTOM_FIELD_TYPES = ["text", "textarea", "select", "checkboxes", "url"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** A question an organizer has added to a form. */
export const customFieldSchema = z
  .object({
    /** Short id the answer is stored under. Never shown. */
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{0,30}$/, "Use lowercase letters, numbers and underscores"),
    label: required(160),
    type: z.enum(CUSTOM_FIELD_TYPES),
    required: z.boolean(),
    /** The choices, for "select" and "checkboxes". */
    options: list(40),
    /** A line of help shown under the question. */
    help: line(300),
    /**
     * Whether judges and mentors see the answer. Off by default: don't turn
     * it on for anything that identifies or contacts a person.
     */
    showToJudges: z.boolean(),
  })
  .superRefine((f, ctx) => {
    if ((f.type === "select" || f.type === "checkboxes") && f.options.length === 0)
      ctx.addIssue({ code: "custom", message: `"${f.label}" needs at least one option`, path: ["options"] });
  });

export type CustomField = z.infer<typeof customFieldSchema>;

const customFieldList = z
  .array(customFieldSchema)
  .max(30)
  .superRefine((fields, ctx) => {
    const keys = fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", message: "Each question needs its own key" });
  });

/**
 * Built-in questions an organizer can switch off. Each entry lists the
 * columns it covers; a hidden question is neither shown nor required.
 */
const TEAMMATE_DETAILS = [2, 3, 4, 5].flatMap((n) => [
  `member${n}_linkedin_url`,
  `member${n}_occupation`,
  `member${n}_country`,
]);

export const HIDEABLE = {
  submission: [
    { id: "phone", label: "Phone number", columns: ["phone"] },
    { id: "location", label: "Country, state and city", columns: ["country", "state_region", "city"] },
    {
      id: "submitter_profile",
      label: "Affiliation, role and LinkedIn profile",
      columns: ["affiliated_org", "submitter_role", "submitter_linkedin_url"],
    },
    { id: "teammate_details", label: "Team-mates' LinkedIn, occupation and country", columns: TEAMMATE_DETAILS },
    { id: "mentor", label: "Mentor", columns: ["mentor_name", "mentor_linkedin_url"] },
    { id: "challenge_track", label: "Challenge track", columns: ["challenge_track"] },
    { id: "problem_brief", label: "Problem brief", columns: ["problem_brief"] },
    { id: "problem_statement", label: "Problem statement", columns: ["problem_statement"] },
    { id: "project_category", label: "Project category", columns: ["project_category"] },
    { id: "technologies_used", label: "Technologies used", columns: ["technologies_used"] },
    { id: "customer_type", label: "Who is it for?", columns: ["customer_type"] },
    { id: "region", label: "Your region", columns: ["region"] },
    { id: "focus_area", label: "Focus area", columns: ["focus_area"] },
    { id: "solution_stage", label: "Solution stage", columns: ["solution_stage"] },
    { id: "area_of_specification", label: "Area of specification", columns: ["area_of_specification"] },
    { id: "applies_ai", label: "Does it apply AI?", columns: ["applies_ai"] },
    { id: "impact_focus", label: "Impact focus", columns: ["impact_focus"] },
    { id: "target_region", label: "Target region / market", columns: ["target_region"] },
    { id: "core_problem", label: "Core problem", columns: ["core_problem"] },
    { id: "code_links", label: "GitHub and live demo links", columns: ["github_url", "live_demo_url"] },
    { id: "demo_video", label: "Demo video", columns: ["demo_video_url", "all_members_in_video"] },
    { id: "pitch_video", label: "Pitch video", columns: ["demo_video_short_url"] },
    {
      id: "materials",
      label: "Pitch deck, one-page summary and disclosure",
      columns: ["pitch_deck_url", "summary_url", "disclosure_statement"],
    },
    { id: "announcement", label: "LinkedIn announcement", columns: ["linkedin_post_url"] },
  ],
  registration: [
    { id: "phone", label: "Phone number", columns: ["phone"] },
    {
      id: "verification",
      label: "LinkedIn or website, to verify identity",
      columns: ["linkedin_url", "website_url"],
    },
    { id: "team", label: "Solo or team, and team name", columns: ["participating_as", "team_name"] },
    { id: "primary_interest", label: "Primary interest (track)", columns: ["primary_interest"] },
    { id: "experience_level", label: "Experience level", columns: ["experience_level"] },
    { id: "organization", label: "Organization", columns: ["organization"] },
    { id: "partner_org", label: "Partner organizations", columns: ["partner_org"] },
    { id: "heard_about", label: "How did you hear about us", columns: ["heard_about"] },
    { id: "referred_by", label: "Referred by", columns: ["referred_by"] },
  ],
  mentor: [
    { id: "phone", label: "Phone number", columns: ["phone"] },
    { id: "occupation", label: "Title or occupation", columns: ["occupation"] },
    { id: "organization", label: "Organization", columns: ["organization"] },
    { id: "linkedin", label: "LinkedIn profile", columns: ["linkedin_url"] },
    { id: "website", label: "Personal website", columns: ["website_url"] },
    { id: "primary_interest", label: "Track they can mentor", columns: ["primary_interest"] },
    { id: "experience_level", label: "Experience level", columns: ["experience_level"] },
    { id: "heard_about", label: "How did you hear about us", columns: ["heard_about"] },
    { id: "referred_by", label: "Referred by", columns: ["referred_by"] },
  ],
} as const satisfies Record<string, readonly { id: string; label: string; columns: readonly string[] }[]>;

export type FormName = keyof typeof HIDEABLE;

const hideableIds = (form: FormName) => HIDEABLE[form].map((h) => h.id) as string[];
const hiddenList = (form: FormName) =>
  z.array(z.string()).transform((ids) => [...new Set(ids)].filter((id) => hideableIds(form).includes(id)));

/**
 * The ids of the built-in questions a form should not ask. Turning the mentor
 * programme off also removes the mentor question from the submission form.
 */
export function hiddenQuestions(
  settings: Pick<EventSettings, "hidden" | "features">,
  form: FormName,
): Set<string> {
  const off = new Set<string>(settings.hidden[form]);
  if (form === "submission" && !settings.features.mentors) off.add("mentor");
  return off;
}

/** The columns a form should neither show nor require. */
export function hiddenColumns(
  settings: Pick<EventSettings, "hidden" | "features">,
  form: FormName,
): Set<string> {
  const off = hiddenQuestions(settings, form);
  return new Set(
    HIDEABLE[form].filter((h) => off.has(h.id)).flatMap((h) => h.columns as readonly string[]),
  );
}

// ── the whole event ──────────────────────────────────────────────

export const settingsSchema = z.object({
  // Identity
  name: required(80),
  /** One word of `name` drawn in the accent colour. Optional. */
  accentWord: line(40),
  tagline: line(160),
  /** For search engines and link previews. */
  description: line(300),

  // When and where. All shown as written.
  dates: line(80),
  submissionDeadline: line(80),
  judgingOpens: line(80),
  format: line(80),
  prizes: line(80),
  /** The submission form has room for up to five people. */
  maxTeamSize: z.coerce.number().int().min(1).max(5),

  host: z.object({ name: required(80), url: line(300) }),
  /** Where participants write when something goes wrong. */
  contactEmail: line(200),
  /** The page or profile teams tag when they announce their project. */
  announceUrl: line(300),

  // Look
  theme: z.object({
    /** The accent colour, as a hex code such as #662EFF. */
    accent: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour such as #662EFF"),
    /** Address of a logo image. Empty shows the Dua mark. */
    logoUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === "" || /^https?:\/\//i.test(v), "Use a full address starting with https://"),
    /** Whether the header links to Dua's source code on GitHub. */
    showSourceLink: z.boolean().default(true),
  }),

  // Judging
  /** How many places the final ranking locks. */
  topN: z.coerce.number().int().min(1).max(20),
  rubric: rubricSchema,

  // Questions on the forms
  /** Questions added by the organizer. */
  customFields: z.object({
    registration: customFieldList,
    submission: customFieldList,
    mentor: customFieldList.default([]),
  }),
  /** Built-in questions switched off, by id: see HIDEABLE. */
  hidden: z.object({
    registration: hiddenList("registration"),
    submission: hiddenList("submission"),
    mentor: hiddenList("mentor").default([]),
  }),

  // Parts of the platform an event may not need
  features: z.object({
    /** Mentor sign-up, and the mentor question on submissions. */
    mentors: z.boolean().default(true),
    /** Registering before submitting. Off means teams go straight to submitting. */
    registration: z.boolean().default(true),
    /** Sending email to registrants from the admin panel. */
    emailCampaigns: z.boolean().default(true),
    /** The "How it works" steps on the homepage. */
    howItWorks: z.boolean().default(true),
  }),

  // How judging runs
  judging: z.object({
    /** Hide team and member names from judges and mentors. */
    anonymous: z.boolean().default(false),
    /** Require a sentence of evidence with every score. */
    requireEvidence: z.boolean().default(true),
    /**
     * "normalized" evens out harsh and generous judges and tests how stable
     * the ranking is; "average" ranks by the plain average of judges' totals.
     */
    ranking: z.enum(["normalized", "average"]).default("normalized"),
    /** Let judges declare a conflict of interest and step back from a project. */
    recusals: z.boolean().default(true),
    /** Show the final ranking to everyone once results are open. */
    publicResults: z.boolean().default(false),
  }),

  // Option lists on the forms
  tracks: list(),
  problemBriefs: list(),
  experienceLevels: list(),
  mentorExperienceLevels: list(),
  heardAbout: list(),
  partnerOrgs: list(),
  focusAreas: list(),
  impactFocus: list(),
  regions: list(),
  areasOfSpecification: list(),
  solutionStages: list(),
  affiliations: list(),
  roles: list(),

  // Homepage
  home: z.object({
    introTitle: line(120),
    /** Paragraphs, separated by a blank line. */
    intro: line(3000),
    pillarsEyebrow: line(60),
    pillarsTitle: line(120),
    pillarsSubtitle: line(240),
    pillars: z
      .array(z.object({ title: required(60), text: line(300), example: line(600) }))
      .max(6),
    /** An example problem statement per track, matched by the track's name. */
    trackExamples: z.array(z.object({ track: required(160), example: line(600) })).max(60),
    faq: z.array(z.object({ q: required(200), a: required(1200) })).max(30),
  }),
});

export type EventSettings = z.infer<typeof settingsSchema>;

const DEFAULT_ACCENT_RGB = [102, 46, 255];

/** The last option on the problem-brief list means "none of these". */
export const OWN_PROBLEM = "Own problem (not one of the briefs)";

export const DEFAULT_RUBRIC: Rubric = {
  criteria: [
    {
      key: "impact",
      label: "Impact",
      weight: 25,
      anchors: {
        limited: "Benefit is vague or not quantified; unclear who gains",
        solid: "Clear benefit to a named group, estimated with rough numbers",
        exceptional:
          "Large, quantified benefit to the people it's built for, backed by real data or real users",
      },
      example:
        "Impact (4): tested with six volunteers at one food bank; unfilled shifts fell from nine a week to two.",
    },
    {
      key: "innovation",
      label: "Innovation",
      weight: 25,
      anchors: {
        limited: "Repeats an existing product or approach",
        solid: "Meaningful improvement or new combination of known approaches",
        exceptional: "Genuinely new approach that addresses a root cause existing solutions miss",
      },
      example:
        "Innovation (5): works entirely by voice, for riders the existing transit apps leave out.",
    },
    {
      key: "sustainability",
      label: "Sustainability",
      weight: 25,
      anchors: {
        limited: "Stops working when the team stops; no plan for cost or upkeep",
        solid: "Plausible plan for who runs it and how its costs are covered",
        exceptional:
          "Cheap to run, simple to maintain, and someone other than the team could keep it going",
      },
      example:
        "Sustainability (2): depends on a paid API with no budget and no one named to maintain it.",
    },
    {
      key: "feasibility",
      label: "Feasibility",
      weight: 15,
      anchors: {
        limited: "Major technical, legal, or data gaps; prototype does not run",
        solid: "Prototype works on sample data; main risks named",
        exceptional:
          "Working prototype on real or realistic data, with a clear path to a first real user",
      },
      example: "Feasibility (2): the demo runs only on invented data and the main feature is mocked.",
    },
    {
      key: "scalability",
      label: "Scalability",
      weight: 10,
      anchors: {
        limited: "Works only for one user or one place under special conditions",
        solid: "Could extend to similar users or places with some adaptation",
        exceptional: "Clear plan to reach many more users, with costs that fall as it grows",
      },
      example: "Scalability (3): could serve other food banks, but each one needs manual setup.",
    },
  ],
  tieBreakers: ["impact", "innovation"],
};

export const DEFAULT_SETTINGS: EventSettings = {
  name: "Open Build Hackathon",
  accentWord: "",
  tagline: "One weekend. One idea. Ship it.",
  description:
    "A sample event running on Dua, the open source hackathon platform: registration, project submission, judging and results in one place.",
  dates: "March 5 – 7, 2027",
  submissionDeadline: "March 7, 2027 at 12:00 PM ET",
  judgingOpens: "March 7, 2027 at 2:00 PM ET",
  format: "100% Virtual · Global",
  prizes: "$5,000 in prizes",
  maxTeamSize: 5,
  host: { name: "Example Org", url: "https://example.org" },
  contactEmail: "hello@example.org",
  announceUrl: "https://example.org/hackathon",

  // The violet from the Dua logo.
  theme: { accent: "#662EFF", logoUrl: "", showSourceLink: true },

  topN: 6,
  rubric: DEFAULT_RUBRIC,

  customFields: { registration: [], submission: [], mentor: [] },
  hidden: { registration: [], submission: [], mentor: [] },
  features: { mentors: true, registration: true, emailCampaigns: true, howItWorks: true },
  judging: {
    anonymous: false,
    requireEvidence: true,
    ranking: "normalized",
    recusals: true,
    publicResults: false,
  },

  tracks: ["Web & Mobile Apps", "AI & Data", "Hardware & Devices", "Developer Tools", "Social Good"],
  problemBriefs: [
    "1 · Help a small nonprofit schedule its volunteers",
    "2 · Make local transit times easier to check",
    "3 · A study tool that still works offline",
    "4 · Cut the time it takes to report a bug well",
    OWN_PROBLEM,
  ],
  experienceLevels: [
    "Student",
    "First-time hacker",
    "Early career (0–2 yrs)",
    "Mid-level (3–7 yrs)",
    "Senior (8+ yrs)",
  ],
  mentorExperienceLevels: [
    "Mid-level (3–7 yrs)",
    "Senior (8–14 yrs)",
    "Executive / 15+ yrs",
    "Academic / Researcher",
  ],
  heardAbout: [
    "LinkedIn",
    "Event website",
    "A partner organization",
    "Friend or colleague",
    "University / school",
    "Newsletter / email",
    "Other social media",
    "Search engine",
  ],
  partnerOrgs: ["Example Engineering Society", "Example Student Network", "Example Founders Community"],
  focusAreas: [
    "Education",
    "Health & Wellbeing",
    "Climate & Environment",
    "Money & Work",
    "Accessibility",
    "Civic & Community",
    "Productivity",
    "Games & Entertainment",
    "Developer Experience",
  ],
  impactFocus: ["Saves time", "Saves money", "Improves access", "Improves safety", "Builds community"],
  regions: ["Africa", "North America", "South America", "Asia", "Europe", "Australia"],
  areasOfSpecification: ["Technology", "Design & Usability", "Business Model", "Policy & Community"],
  solutionStages: ["Idea / Concept", "Prototype", "MVP / Pilot", "Deployed / In Market"],
  affiliations: [
    "Startup",
    "Corporate",
    "Nonprofit / NGO",
    "University / Student Org",
    "Independent",
  ],
  roles: [
    "Software Engineer",
    "Designer",
    "Product / Founder",
    "Data Scientist",
    "Hardware Engineer",
    "Policy Analyst",
    "Engineer",
    "Student",
  ],

  home: {
    introTitle: "What Is This Hackathon?",
    intro:
      "This is a time-bound competition where teams of students, engineers, founders and community innovators design and prototype practical solutions to real problems. You build and defend a working concept under deadline pressure, not just discuss ideas.\n\nThis is a sample event. Everything on this page, from the name and dates to the tracks below, is placeholder copy that ships with the platform so you can see how an event looks before you set up your own.",
    pillarsEyebrow: "What Counts",
    pillarsTitle: "Useful, Original, Working",
    pillarsSubtitle: "The three things judges look for in every entry.",
    pillars: [
      {
        title: "Useful",
        text: "Solve a real problem for real people, and say who they are.",
        example:
          "A food bank coordinates 40 volunteers by group chat and loses track of who is coming. Build something that tells the organizer, each morning, which shifts are still empty.",
      },
      {
        title: "Original",
        text: "Bring a new angle, not a copy of something that already exists.",
        example:
          "Plenty of apps show bus times. Build one for a rider who can't look at a screen: it speaks the next departure and nothing else.",
      },
      {
        title: "Working",
        text: "Show it running. A rough demo beats a polished slide.",
        example:
          "Record three minutes of someone outside your team using it from start to finish, with no one helping them.",
      },
    ],
    trackExamples: [
      {
        track: "Web & Mobile Apps",
        example:
          "Build an app a neighbourhood group could start using on Monday without any training.",
      },
      {
        track: "AI & Data",
        example:
          "Take a public dataset nobody reads and turn it into an answer to one question people keep asking.",
      },
      {
        track: "Hardware & Devices",
        example:
          "Build a device under $30 in parts that tells you something useful about the room it's in.",
      },
      {
        track: "Developer Tools",
        example: "Remove one step that every developer on your team repeats by hand each day.",
      },
      {
        track: "Social Good",
        example: "Pick one local organization, ask what slows them down most, and build for that.",
      },
    ],
    faq: [
      {
        q: "Who can participate?",
        a: "Anyone, anywhere — students, professionals, founders, and first-time hackers. It's virtual and free to join.",
      },
      {
        q: "Do I need a team?",
        a: "No. Compete solo or form a team. You can register now and finalize your team later.",
      },
      {
        q: "What should I build?",
        a: "Anything that fits one of the challenge tracks. Pick one of the problem briefs or bring a problem of your own.",
      },
      { q: "How much does it cost?", a: "Nothing. Registration and participation are free." },
      {
        q: "How is judging kept fair?",
        a: "Every judge scores against the same rubric and writes one sentence of evidence per score. Scores are normalized per judge, so a harsh judge and a generous one carry the same weight, and judges recuse themselves from projects where they have a conflict.",
      },
    ],
  },
};

/**
 * Turn whatever is stored for an event into complete settings. Anything
 * missing or invalid falls back to the default for that one value, so a
 * half-filled or older record never breaks a page.
 */
export function resolveSettings(stored: unknown): EventSettings {
  const raw = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const shape = settingsSchema.shape as Record<string, z.ZodTypeAny>;
  for (const key of Object.keys(shape)) {
    if (!(key in raw)) continue;
    const parsed = shape[key].safeParse(raw[key]);
    if (parsed.success) merged[key] = parsed.data;
  }
  return merged as EventSettings;
}

/**
 * The accent colour, two darker shades of it, and a lighter one for dark
 * backgrounds, as "r g b" triplets for the CSS variables the stylesheet reads.
 */
export function accentShades(hex: string): {
  accent: string;
  dark: string;
  deep: string;
  onDark: string;
} {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  const rgb = m ? [m[1], m[2], m[3]].map((h) => parseInt(h, 16)) : DEFAULT_ACCENT_RGB;
  const shade = (by: number) => rgb.map((c) => Math.round(c * by)).join(" ");
  // Mixed 40% toward white, so it still reads on a dark page.
  const tint = rgb.map((c) => Math.round(c + (255 - c) * 0.4)).join(" ");
  return { accent: rgb.join(" "), dark: shade(0.78), deep: shade(0.55), onDark: tint };
}
