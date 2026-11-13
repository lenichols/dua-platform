import { z } from "zod";

// People type "github.com/me" or "www.linkedin.com/in/me"; add the scheme
// rather than reject the whole submission for it.
const withScheme = (v: unknown) =>
  typeof v === "string" && v.trim() && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v.trim())
    ? `https://${v.trim()}`
    : v;

const url = z.preprocess(
  withScheme,
  z.string().trim().url({ message: "Must be a valid URL" }).or(z.literal("")),
);

// International phone: optional leading "+", then digits with common
// separators. Must contain at least 7 digits to be plausible.
const phone = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .regex(/^\+?[\d\s().-]{7,25}$/, "Enter a valid phone number")
  .refine(
    (v) => (v.replace(/\D/g, "").length ?? 0) >= 7,
    "Phone number must have at least 7 digits",
  );

export const submissionSchema = z.object({
  // contestant
  member1_name: z.string().trim().min(2, "Full name required"),
  member1_email: z.string().trim().email("Valid email required"),
  phone,
  country: z.string().trim().min(1, "Country is required"),
  state_region: z.string().trim().default(""),
  city: z.string().trim().default(""),
  submitter_linkedin_url: url.optional().default(""),
  affiliated_org: z.string().trim().default(""),
  submitter_role: z.string().trim().default(""),

  solo_or_team: z.enum(["Solo", "Team"]),
  team_name: z.string().trim().default(""),

  member2_name: z.string().trim().default(""),
  member2_email: z
    .string()
    .trim()
    .email("Invalid email")
    .or(z.literal(""))
    .default(""),
  member2_linkedin_url: url.optional().default(""),
  member2_occupation: z.string().trim().default(""),
  member2_country: z.string().trim().default(""),
  member3_name: z.string().trim().default(""),
  member3_email: z
    .string()
    .trim()
    .email("Invalid email")
    .or(z.literal(""))
    .default(""),
  member3_linkedin_url: url.optional().default(""),
  member3_occupation: z.string().trim().default(""),
  member3_country: z.string().trim().default(""),
  member4_name: z.string().trim().default(""),
  member4_email: z
    .string()
    .trim()
    .email("Invalid email")
    .or(z.literal(""))
    .default(""),
  member4_linkedin_url: url.optional().default(""),
  member4_occupation: z.string().trim().default(""),
  member4_country: z.string().trim().default(""),
  member5_name: z.string().trim().default(""),
  member5_email: z
    .string()
    .trim()
    .email("Invalid email")
    .or(z.literal(""))
    .default(""),
  member5_linkedin_url: url.optional().default(""),
  member5_occupation: z.string().trim().default(""),
  member5_country: z.string().trim().default(""),

  // mentor (optional; name and LinkedIn)
  mentor_name: z.string().trim().default(""),
  mentor_linkedin_url: url.optional().default(""),

  // project
  project_name: z.string().trim().min(2, "Project name required"),
  challenge_track: z.string().trim().default(""),
  problem_brief: z
    .string()
    .trim()
    .min(1, "Select the problem brief you worked on"),
  project_category: z.string().trim().min(1, "Project category is required"),
  customer_type: z.enum(["Individuals", "Organizations"], {
    message: "Tell us who the project is for",
  }),
  region: z.string().trim().min(1, "Select your region"),
  area_of_specification: z
    .string()
    .trim()
    .min(1, "Select an area of specification"),
  focus_area: z.string().trim().min(1, "Focus area is required"),
  impact_focus: z.string().trim().min(1, "Select at least one impact focus"),
  solution_stage: z.string().trim().min(1, "Solution stage is required"),
  target_region: z.string().trim().default(""),
  core_problem: z
    .string()
    .trim()
    .min(1, "Tell us the core problem you're addressing"),
  applies_ai: z.enum(["Yes", "No"], {
    message: "Tell us whether your solution applies AI",
  }),
  problem_statement: z
    .string()
    .trim()
    .min(30, "Please write at least 30 characters")
    .refine(
      (v) => v.split(/\s+/).filter(Boolean).length <= 250,
      "Keep your problem statement under 250 words",
    ),
  project_description: z
    .string()
    .trim()
    .min(30, "Please write at least 30 characters")
    .refine(
      (v) => v.split(/\s+/).filter(Boolean).length <= 500,
      "Keep the description under 500 words",
    ),
  project_description_summary: z
    .string()
    .trim()
    .min(1, "One-line summary is required")
    .max(280, "Keep it under 280 chars"),
  technologies_used: z.string().trim().min(1, "Technologies used is required"),

  github_url: url.optional().default(""),
  live_demo_url: url.optional().default(""),
  demo_video_url: url.optional().default(""),
  demo_video_short_url: url.optional().default(""),
  linkedin_post_url: z
    .string()
    .trim()
    .min(1, "LinkedIn post URL is required")
    .url("Must be a valid URL"),
  // Required deliverables, alongside the demo video
  pitch_deck_url: z
    .string()
    .trim()
    .min(1, "Pitch deck link is required")
    .url("Must be a valid URL"),
  summary_url: z
    .string()
    .trim()
    .min(1, "One-page summary link is required")
    .url("Must be a valid URL"),
  disclosure_statement: z
    .string()
    .trim()
    .min(
      20,
      "Tell judges what existed before the event and what you built during it",
    )
    .refine(
      (v) => v.split(/\s+/).filter(Boolean).length <= 250,
      "Keep the disclosure under 250 words",
    ),
  all_members_in_video: z.string().trim().default(""),
  team_size: z.coerce.number().int().min(1).max(10).default(1),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

/**
 * The submission rules for an event: the same as above, except that
 * questions the organizer has switched off are not required.
 */
export function submissionSchemaFor(hidden: ReadonlySet<string>) {
  const optional = z.string().trim().optional().default("");
  const relaxed = Object.fromEntries(
    Object.keys(submissionSchema.shape)
      .filter((k) => hidden.has(k))
      .map((k) => [k, optional]),
  );
  return submissionSchema.extend(relaxed) as unknown as typeof submissionSchema;
}
