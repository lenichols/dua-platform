"use server";

import { submissionSchema } from "@/lib/submission-schema";
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

export async function submitProject(
  _prev: SubmitResult | null,
  form: FormData,
): Promise<SubmitResult> {
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

  // Both new submissions and edits need the submissions phase AND the form
  // opened by an admin, so closing submissions also cuts off every edit link.
  const event = await getCurrentEvent();
  const data = await createSubmission(event, input);
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
  const result = await update(await getCurrentEvent(), id, parsed.data);
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
