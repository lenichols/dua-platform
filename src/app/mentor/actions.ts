"use server";

import { parseCustomAnswers } from "@/lib/custom-fields";
import { hiddenColumns } from "@/lib/event-settings";
import { mentorRegistrationSchemaFor } from "@/lib/registration-schema";
import { getCurrentEvent } from "@/server/event";
import { mentorSignupAccepting } from "@/server/policy";
import { createRegistration } from "@/server/registrations";

const CLOSED = "Mentor sign-up is closed — the hackathon is already underway.";
const DUPLICATE =
  "You've already signed up as a mentor with that email — thank you! We'll be in touch.";

export type MentorRegisterResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerMentor(
  _prev: MentorRegisterResult | null,
  form: FormData,
): Promise<MentorRegisterResult> {
  // Registration needs the admin switch on, and closes outright once the
  // event moves into judging/results.
  const event = await getCurrentEvent();
  if (!mentorSignupAccepting(event)) return { ok: false, error: CLOSED };

  const raw = Object.fromEntries(form.entries());
  const parsed = mentorRegistrationSchemaFor(hiddenColumns(event.settings, "mentor")).safeParse(raw);
  const custom = parseCustomAnswers(event.settings.customFields.mentor, form);
  if (!parsed.success || !custom.ok) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: {
        ...(parsed.success ? {} : (parsed.error.flatten().fieldErrors as Record<string, string[]>)),
        ...(custom.ok ? {} : custom.fieldErrors),
      },
    };
  }

  // Personal details: only admins can read these back.
  const result = await createRegistration(event, "mentor", { ...parsed.data, custom: custom.values });
  if (result.ok) return { ok: true, id: result.id };
  return { ok: false, error: result.reason === "duplicate" ? DUPLICATE : CLOSED };
}
