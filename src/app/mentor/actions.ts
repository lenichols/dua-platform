"use server";

import { mentorRegistrationSchema } from "@/lib/registration-schema";
import { getCurrentEvent } from "@/server/event";
import { registrationAccepting } from "@/server/policy";
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
  if (!registrationAccepting(event)) return { ok: false, error: CLOSED };

  const raw = Object.fromEntries(form.entries());
  const parsed = mentorRegistrationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  // Personal details: only admins can read these back.
  const result = await createRegistration(event, "mentor", parsed.data);
  if (result.ok) return { ok: true, id: result.id };
  return { ok: false, error: result.reason === "duplicate" ? DUPLICATE : CLOSED };
}
