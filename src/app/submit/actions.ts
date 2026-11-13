"use server";

import { submissionSchema } from "@/lib/submission-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/email";
import { editUrl, sendEditLinkEmail, verifyEditToken } from "@/lib/submission-edit";

export type SubmitResult =
  | { ok: true; id: string; editUrl: string; updated?: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const CLOSED_ERROR =
  "Submissions aren't open right now. Contact the organizers if you believe this is a mistake.";

const DUPLICATE_ERROR =
  "A project with that name has already been submitted. One submission per team — if you meant to edit yours, use the edit link we emailed you.";

/**
 * Both new submissions and edits need the submissions phase AND the form
 * explicitly opened by an admin (defaults closed), so closing submissions
 * also cuts off every edit link. Reads with the service-role client so this
 * can't drift from what the admin panel sees due to RLS or auth-context
 * quirks; a missing/null phase defaults to "submissions", matching the panel
 * and the table-level default.
 */
async function submissionsAccepting(
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  const { data: state, error } = await admin
    .from("event_state")
    .select("phase, submissions_open")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("submissions gate: failed to read event_state", error);
  }
  const rawPhase = (state?.phase ?? "").toString().trim().toLowerCase();
  const phase = rawPhase || "submissions";
  return phase === "submissions" && state?.submissions_open === true;
}

export async function submitProject(
  _prev: SubmitResult | null,
  form: FormData,
): Promise<SubmitResult> {
  const admin = createAdminClient();
  if (!(await submissionsAccepting(admin))) {
    return { ok: false, error: CLOSED_ERROR };
  }

  const raw = Object.fromEntries(form.entries());
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    // Field names only, never answers, so failures show up in the logs.
    console.warn("submission rejected:", Object.keys(parsed.error.flatten().fieldErrors).join(", "));
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  // Service-role insert — bypasses the public-insert RLS policy (which
  // would also work, but we want consistent inserts and controlled columns).
  const { data, error } = await admin
    .from("submissions")
    .insert({
      ...input,
      is_submission_complete: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: DUPLICATE_ERROR };
    return { ok: false, error: error.message };
  }

  const url = editUrl(siteUrl(), data.id);
  // The link is also shown on the success screen, so a failed email
  // doesn't lose it.
  const sent = await sendEditLinkEmail({
    to: input.member1_email,
    name: input.member1_name,
    project: input.project_name,
    url,
  }).catch((e) => ({ ok: false as const, error: String(e) }));
  if (!sent.ok) {
    console.error("submitProject: edit-link email failed", data.id, sent.error);
  }

  return { ok: true, id: data.id, editUrl: url };
}

export async function updateSubmission(
  id: string,
  token: string,
  form: FormData,
): Promise<SubmitResult> {
  if (!verifyEditToken(id, token)) {
    return { ok: false, error: "This edit link isn't valid." };
  }
  const admin = createAdminClient();
  if (!(await submissionsAccepting(admin))) {
    return {
      ok: false,
      error: "Submissions have closed, so this submission can no longer be edited.",
    };
  }

  const raw = Object.fromEntries(form.entries());
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    // Field names only, never answers, so failures show up in the logs.
    console.warn("submission rejected:", Object.keys(parsed.error.flatten().fieldErrors).join(", "));
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Only form fields change; review flags, visibility and created_at stay.
  const { data, error } = await admin
    .from("submissions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Another project already uses that name. Pick a different project name.",
      };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "This submission no longer exists." };

  return { ok: true, id, editUrl: editUrl(siteUrl(), id), updated: true };
}
