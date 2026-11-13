import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .url("Enter a full URL (include https://)")
  .or(z.literal(""))
  .default("");

const registrationFields = {
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
};

// Rules that span more than one field. Each applies only while the questions
// it is about are being asked.
function refineRegistration<T extends z.ZodTypeAny>(schema: T, hidden: ReadonlySet<string>) {
  let out: z.ZodTypeAny = schema;
  if (!hidden.has("participating_as"))
    out = out.refine(
      (d: { participating_as: string; team_name: string }) =>
        d.participating_as !== "Team" || d.team_name.trim().length > 0,
      { message: "Team name required", path: ["team_name"] },
    );
  if (!hidden.has("linkedin_url"))
    out = out.refine(
      (d: { linkedin_url: string; website_url: string }) => d.linkedin_url !== "" || d.website_url !== "",
      {
        message: "Add a LinkedIn profile or personal website so we can verify you",
        path: ["linkedin_url"],
      },
    );
  return out;
}

const NOTHING_HIDDEN: ReadonlySet<string> = new Set();
const optional = z.string().trim().optional().default("");

function relax<S extends z.ZodRawShape>(shape: S, hidden: ReadonlySet<string>): z.ZodRawShape {
  return {
    ...shape,
    ...Object.fromEntries(Object.keys(shape).filter((k) => hidden.has(k)).map((k) => [k, optional])),
  };
}

// Public pre-event registration. Lighter than the project submission schema —
// this just builds the participant list.
export const registrationSchema = refineRegistration(
  z.object(registrationFields),
  NOTHING_HIDDEN,
) as z.ZodType<RegistrationInput, z.ZodTypeDef, unknown>;

/**
 * The registration rules for an event: the same, except that questions the
 * organizer has switched off are not required.
 */
export function registrationSchemaFor(hidden: ReadonlySet<string>) {
  return refineRegistration(z.object(relax(registrationFields, hidden)), hidden) as typeof registrationSchema;
}

const registrationObject = z.object(registrationFields);
export type RegistrationInput = z.infer<typeof registrationObject>;

// Public mentor sign-up (/mentor). Written to the same registrations table
// with role='mentor'. LinkedIn is required — mentors are vetted people.
const mentorFields = {
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
};

export const mentorRegistrationSchema = z.object(mentorFields);

/** The mentor sign-up rules for an event, minus questions switched off. */
export function mentorRegistrationSchemaFor(hidden: ReadonlySet<string>) {
  return z.object(relax(mentorFields, hidden)) as unknown as typeof mentorRegistrationSchema;
}

export type MentorRegistrationInput = z.infer<typeof mentorRegistrationSchema>;
