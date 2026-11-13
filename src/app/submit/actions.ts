"use server";

import { parseCustomAnswers } from "@/lib/custom-fields";
import { hiddenColumns, type EventSettings } from "@/lib/event-settings";
import { submissionSchemaFor, type SubmissionInput } from "@/lib/submission-schema";
import { getCurrentEvent } from "@/server/event";
import { createSubmission, updateSubmission as update } from "@/server/submissions";
import { siteUrl } from "@/lib/email";
import { editUrl, sendEditLinkEmail, verifyEditToken } from "@/lib/submission-edit";

export type SubmitResult =
  | { ok: true; id: string; editUrl: string; updated?: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const CLOSED_ERROR =
  "Submissions aren't open right now. Contact the organizers if you believe this is a mistake.";

const DUPLICATE_ERROR =
  "A project with that name has already been submitted. One submission per team — if you meant to edit yours, use the edit link we emailed you.";

/** Check a posted form against this event's rules: built-in questions and its own. */
function checkSubmission(
  settings: EventSettings,
  form: FormData,
):
  | { ok: true; data: SubmissionInput; custom: Record<string, string> }
  | { ok: false; result: SubmitResult } {
  const parsed = submissionSchemaFor(hiddenColumns(settings, "submission")).safeParse(
    Object.fromEntries(form.entries()),
  );
  const custom = parseCustomAnswers(settings.customFields.submission, form);
  if (parsed.success && custom.ok) return { ok: true, data: parsed.data, custom: custom.values };

  const fieldErrors = {
    ...(parsed.success ? {} : (parsed.error.flatten().fieldErrors as Record<string, string[]>)),
    ...(custom.ok ? {} : custom.fieldErrors),
  };
  // Field names only, never answers, so failures show up in the logs.
  console.warn("submission rejected:", Object.keys(fieldErrors).join(", "));
  return { ok: false, result: { ok: false, error: "Please fix the errors below.", fieldErrors } };
}

export async function submitProject(
  _prev: SubmitResult | null,
  form: FormData,
): Promise<SubmitResult> {
  const event = await getCurrentEvent();
  const checked = checkSubmission(event.settings, form);
  if (!checked.ok) return checked.result;
  const parsed = checked;
  const input = parsed.data;

  // Both new submissions and edits need the submissions phase AND the form
  // opened by an admin, so closing submissions also cuts off every edit link.
  const data = await createSubmission(event, input, parsed.custom);
  if (!data.ok) {
    return { ok: false, error: data.reason === "duplicate" ? DUPLICATE_ERROR : CLOSED_ERROR };
  }

  const url = editUrl(siteUrl(), data.id);
  // The link is also shown on the success screen, so a failed email
  // doesn't lose it.
  const sent = await sendEditLinkEmail({
    to: input.member1_email,
    name: input.member1_name,
    project: input.project_name,
    url,
    event: event.settings,
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
  const event = await getCurrentEvent();
  const checked = checkSubmission(event.settings, form);
  if (!checked.ok) return checked.result;
  const parsed = checked;

  // Only form fields change; review flags, visibility and created_at stay.
  const result = await update(event, id, parsed.data, parsed.custom);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "duplicate"
          ? "Another project already uses that name. Pick a different project name."
          : result.reason === "missing"
            ? "This submission no longer exists."
            : "Submissions have closed, so this submission can no longer be edited.",
    };
  }

  return { ok: true, id, editUrl: editUrl(siteUrl(), id), updated: true };
}
