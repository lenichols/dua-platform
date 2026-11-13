"use server";

import { mentorRegistrationSchema } from "@/lib/registration-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export type MentorRegisterResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerMentor(
  _prev: MentorRegisterResult | null,
  form: FormData,
): Promise<MentorRegisterResult> {
  const admin = createAdminClient();

  // Same gate as participant registration: the admin switch, and closed
  // outright once the event moves into judging/results.
  const { data: state } = await admin
    .from("event_state")
    .select("phase, registration_open")
    .eq("id", 1)
    .maybeSingle();
  const phase = (state?.phase ?? "submissions").toString().trim().toLowerCase();
  if (phase === "judging" || phase === "results" || state?.registration_open !== true) {
    return {
      ok: false,
      error: "Mentor sign-up is closed — the hackathon is already underway.",
    };
  }

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

  // Service-role insert — RLS denies all direct public access to
  // registrations, so PII stays admin-only.
  const { data, error } = await admin
    .from("registrations")
    .insert({ ...parsed.data, role: "mentor" })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "You've already signed up as a mentor with that email — thank you! We'll be in touch.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id };
}
