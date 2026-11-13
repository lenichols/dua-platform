"use server";

import { parseCustomAnswers } from "@/lib/custom-fields";
import { hiddenColumns } from "@/lib/event-settings";
import { registrationSchemaFor } from "@/lib/registration-schema";
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
  // Questions the organizer switched off aren't required; ones they added are checked too.
  const parsed = registrationSchemaFor(hiddenColumns(event.settings, "registration")).safeParse(raw);
  const custom = parseCustomAnswers(event.settings.customFields.registration, form);
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
  const result = await createRegistration(event, "participant", { ...parsed.data, custom: custom.values });
  if (result.ok) return { ok: true, id: result.id };
  return { ok: false, error: result.reason === "duplicate" ? DUPLICATE : CLOSED };
}
