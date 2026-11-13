"use server";

import { registrationSchema } from "@/lib/registration-schema";
import { getCurrentEvent } from "@/server/event";
import { registrationAccepting } from "@/server/policy";
import { createRegistration } from "@/server/registrations";

const CLOSED = "Registration is closed — the hackathon is already underway.";
const DUPLICATE =
  "You're already registered with that email — see you at the hackathon!";

export type RegisterResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerParticipant(
  _prev: RegisterResult | null,
  form: FormData,
): Promise<RegisterResult> {
  // Registration needs the admin switch on, and closes outright once the
  // event moves into judging/results.
  const event = await getCurrentEvent();
  if (!registrationAccepting(event)) return { ok: false, error: CLOSED };

  const raw = Object.fromEntries(form.entries());
  const parsed = registrationSchema.safeParse(raw);
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
  const result = await createRegistration(event, "participant", parsed.data);
  if (result.ok) return { ok: true, id: result.id };
  return { ok: false, error: result.reason === "duplicate" ? DUPLICATE : CLOSED };
}
