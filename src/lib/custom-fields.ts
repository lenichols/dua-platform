// Reading and checking answers to the questions an organizer has added to a
// form. Safe to import from client components.

import type { CustomField } from "./event-settings";

/** The form-field name an answer is posted under. */
export const customFieldName = (key: string) => `custom.${key}`;

const MAX_ANSWER_LENGTH = 4000;

export type CustomAnswers = Record<string, string>;

export type ParsedCustom =
  | { ok: true; values: CustomAnswers }
  | { ok: false; fieldErrors: Record<string, string[]> };

/**
 * Pick the answers to an event's own questions out of a posted form and
 * check them. Answers to questions that aren't on the form are ignored.
 * Several ticked boxes are stored joined with ", ".
 */
export function parseCustomAnswers(fields: readonly CustomField[], form: FormData): ParsedCustom {
  const values: CustomAnswers = {};
  const fieldErrors: Record<string, string[]> = {};
  const fail = (f: CustomField, message: string) => (fieldErrors[customFieldName(f.key)] = [message]);

  for (const f of fields) {
    const posted = form
      .getAll(customFieldName(f.key))
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);

    if (posted.length === 0) {
      if (f.required) fail(f, `${f.label} is required`);
      continue;
    }

    if (f.type === "select" || f.type === "checkboxes") {
      const picked = f.type === "select" ? posted.slice(0, 1) : posted;
      if (picked.some((v) => !f.options.includes(v))) {
        fail(f, `Pick from the options for ${f.label}`);
        continue;
      }
      values[f.key] = [...new Set(picked)].join(", ");
      continue;
    }

    const answer = posted[0];
    if (answer.length > MAX_ANSWER_LENGTH) {
      fail(f, `Keep ${f.label} under ${MAX_ANSWER_LENGTH} characters`);
      continue;
    }
    if (f.type === "url" && !/^https?:\/\/\S+\.\S+/i.test(answer)) {
      fail(f, "Enter a full URL (include https://)");
      continue;
    }
    values[f.key] = answer;
  }

  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, values };
}

/** Stored answers as label and value pairs, in the form's order, for display. */
export function customAnswerRows(
  fields: readonly CustomField[],
  answers: CustomAnswers | null | undefined,
  opts: { judgesOnly?: boolean } = {},
): { key: string; label: string; value: string; type: CustomField["type"] }[] {
  return fields
    .filter((f) => !opts.judgesOnly || f.showToJudges)
    .map((f) => ({ key: f.key, label: f.label, value: (answers?.[f.key] ?? "").trim(), type: f.type }))
    .filter((r) => r.value !== "");
}
