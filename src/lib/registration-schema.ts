import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .url("Enter a full URL (include https://)")
  .or(z.literal(""))
  .default("");

// Public pre-event registration. Lighter than the project submission schema —
// this just builds the participant list.
export const registrationSchema = z
  .object({
    full_name: z.string().trim().min(2, "Full name required"),
    email: z.string().trim().email("Valid email required"),
    phone: z
      .string()
      .trim()
      .regex(
        /^\+?[\d\s().-]{7,20}$/,
        "Enter a valid phone number (digits, spaces, and + ( ) - . only)",
      ),
    country: z.string().trim().min(1, "Country is required"),
    participating_as: z.enum(["Solo", "Team"]),
    team_name: z.string().trim().default(""),
    primary_interest: z.string().trim().min(1, "Pick your primary interest"),
    experience_level: z.string().trim().min(1, "Select your experience level"),
    organization: z.string().trim().default(""),
    partner_org: z.string().trim().default(""),
    // At least one is required so organizers can verify identity.
    linkedin_url: optionalUrl,
    website_url: optionalUrl,
    heard_about: z.string().trim().min(1, "Let us know how you heard about us"),
    referred_by: z
      .string()
      .trim()
      .min(2, "Tell us who referred you (a name or organization)"),
  })
  .refine(
    (d) => d.participating_as !== "Team" || d.team_name.trim().length > 0,
    { message: "Team name required", path: ["team_name"] },
  )
  .refine((d) => d.linkedin_url !== "" || d.website_url !== "", {
    message: "Add a LinkedIn profile or personal website so we can verify you",
    path: ["linkedin_url"],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

// Public mentor sign-up (/mentor). Written to the same registrations table
// with role='mentor'. LinkedIn is required — mentors are vetted people.
export const mentorRegistrationSchema = z.object({
  full_name: z.string().trim().min(2, "Full name required"),
  email: z.string().trim().email("Valid email required"),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[\d\s().-]{7,20}$/,
      "Enter a valid phone number (digits, spaces, and + ( ) - . only)",
    ),
  country: z.string().trim().min(1, "Country is required"),
  occupation: z.string().trim().min(2, "Your title / occupation is required"),
  organization: z.string().trim().default(""),
  linkedin_url: z
    .string()
    .trim()
    .min(1, "LinkedIn profile is required for mentors")
    .url("Enter a full URL (include https://)"),
  website_url: optionalUrl,
  primary_interest: z
    .string()
    .trim()
    .min(1, "Pick the track you can mentor"),
  experience_level: z.string().trim().min(1, "Select your experience level"),
  heard_about: z.string().trim().min(1, "Let us know how you heard about us"),
  referred_by: z
    .string()
    .trim()
    .min(2, "Tell us who referred you (a name or organization)"),
});

export type MentorRegistrationInput = z.infer<typeof mentorRegistrationSchema>;
