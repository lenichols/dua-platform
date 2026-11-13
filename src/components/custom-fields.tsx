"use client";

import type { CustomField } from "@/lib/event-settings";
import { customFieldName } from "@/lib/custom-fields";

/**
 * The questions an organizer has added to a form. Renders nothing when there
 * are none. Answers post as `custom.<key>`.
 */
export function CustomFields({
  fields,
  initial,
  errors,
  legend = "More About Your Entry",
}: {
  fields: readonly CustomField[];
  /** Saved answers, when editing. */
  initial?: Record<string, string> | null;
  errors?: Record<string, string[]>;
  legend?: string;
}) {
  if (fields.length === 0) return null;
  return (
    <fieldset className="card space-y-4" data-custom-fields>
      <legend className="pill-accent -mt-2 mb-2">{legend}</legend>
      {fields.map((f) => {
        const name = customFieldName(f.key);
        const saved = initial?.[f.key] ?? "";
        const error = errors?.[name]?.[0];
        return (
          <div key={f.key}>
            <label className="field-label" htmlFor={name}>
              {f.label}
              {f.required && " *"}
            </label>
            {f.type === "textarea" ? (
              <textarea id={name} name={name} rows={4} required={f.required} defaultValue={saved} className="field-input mt-1" />
            ) : f.type === "select" ? (
              <select id={name} name={name} required={f.required} defaultValue={saved} className="field-input mt-1">
                <option value="">— Select —</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === "checkboxes" ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {f.options.map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm text-bone">
                    <input
                      type="checkbox"
                      name={name}
                      value={o}
                      defaultChecked={saved.split(", ").includes(o)}
                    />
                    {o}
                  </label>
                ))}
              </div>
            ) : (
              <input
                id={name}
                name={name}
                type={f.type === "url" ? "url" : "text"}
                required={f.required}
                defaultValue={saved}
                placeholder={f.type === "url" ? "https://…" : undefined}
                className="field-input mt-1"
              />
            )}
            {f.help && <p className="mt-1 text-[0.7rem] text-dust">{f.help}</p>}
            {error && <p className="mt-1 text-xs text-blood">{error}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}
