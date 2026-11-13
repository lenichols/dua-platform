"use client";

// The Event tab: everything about the event an organizer can change without
// touching code. Edits are kept in the browser until Save is pressed; the
// server checks all of it again before storing anything.

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEvent } from "@/components/event-context";
import {
  CUSTOM_FIELD_TYPES,
  HIDEABLE,
  type Criterion,
  type CustomField,
  type EventSettings,
  type FormName,
} from "@/lib/event-settings";
import { saveSettings, uploadCampaignImage } from "./actions";

type ListKey = {
  [K in keyof EventSettings]: EventSettings[K] extends string[] ? K : never;
}[keyof EventSettings];

const LISTS: { key: ListKey; label: string; hint: string }[] = [
  { key: "tracks", label: "Challenge tracks", hint: "Registration, mentor and submission forms, and the homepage." },
  { key: "problemBriefs", label: "Problem briefs", hint: "Submission form. Include an option for teams bringing their own problem." },
  { key: "experienceLevels", label: "Participant experience levels", hint: "Registration form." },
  { key: "mentorExperienceLevels", label: "Mentor experience levels", hint: "Mentor sign-up form." },
  { key: "heardAbout", label: "How did you hear about us", hint: "Registration and mentor forms." },
  { key: "partnerOrgs", label: "Partner organizations", hint: "Registration form." },
  { key: "focusAreas", label: "Focus areas", hint: "Submission form." },
  { key: "impactFocus", label: "Impact focus", hint: "Submission form, pick any that apply." },
  { key: "regions", label: "Regions", hint: "Submission form." },
  { key: "areasOfSpecification", label: "Areas of specification", hint: "Submission form." },
  { key: "solutionStages", label: "Solution stages", hint: "Submission form." },
  { key: "affiliations", label: "Affiliations", hint: "Submission form." },
  { key: "roles", label: "Roles", hint: "Submission form." },
];

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "c$1")
    .slice(0, 30) || "criterion";

export function EventPanel({
  readOnly,
  rubricLocked,
}: {
  readOnly: boolean;
  /** Judges have started scoring, so criteria and weights are fixed. */
  rubricLocked: boolean;
}) {
  const saved = useEvent();
  const router = useRouter();
  const [draft, setDraft] = useState<EventSettings>(saved);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const weightTotal = draft.rubric.criteria.reduce((t, c) => t + (Number(c.weight) || 0), 0);

  function set<K extends keyof EventSettings>(key: K, value: EventSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setResult(null);
  }
  const setHome = <K extends keyof EventSettings["home"]>(key: K, value: EventSettings["home"][K]) =>
    set("home", { ...draft.home, [key]: value });

  // ── rubric ──
  const criteria = draft.rubric.criteria;
  const setRubric = (next: Criterion[], ties = draft.rubric.tieBreakers) =>
    set("rubric", {
      criteria: next,
      // Ties are settled in the order the criteria are listed.
      tieBreakers: next.map((c) => c.key).filter((k) => ties.includes(k)),
    });
  const editCriterion = (i: number, patch: Partial<Criterion>) =>
    setRubric(criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const moveCriterion = (i: number, by: number) => {
    const next = [...criteria];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item);
    setRubric(next);
  };
  const toggleTie = (key: string) =>
    setRubric(
      criteria,
      draft.rubric.tieBreakers.includes(key)
        ? draft.rubric.tieBreakers.filter((k) => k !== key)
        : [...draft.rubric.tieBreakers, key],
    );
  const addCriterion = () => {
    let key = "criterion";
    for (let n = 2; criteria.some((c) => c.key === key); n++) key = `criterion_${n}`;
    setRubric([
      ...criteria,
      { key, label: "", weight: 0, anchors: { limited: "", solid: "", exceptional: "" }, example: "" },
    ]);
  };

  const [uploading, setUploading] = useState(false);
  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    const r = await uploadCampaignImage(form);
    setUploading(false);
    if (r.ok) set("theme", { ...draft.theme, logoUrl: r.url });
    else setResult({ ok: false, message: r.error });
  }

  function save() {
    start(async () => {
      const r = await saveSettings(draft);
      if (r.ok) {
        setResult({ ok: true, message: "Saved. The site now shows these settings." });
        router.refresh();
      } else {
        setResult({ ok: false, message: r.error });
      }
    });
  }

  const disabled = readOnly || pending;
  const text = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { hint?: string; area?: number; placeholder?: string } = {},
  ) => (
    <label className="block">
      <span className="field-label">{label}</span>
      {opts.area ? (
        <textarea
          rows={opts.area}
          className="field-input mt-1"
          value={value}
          disabled={disabled}
          placeholder={opts.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="field-input mt-1"
          value={value}
          disabled={disabled}
          placeholder={opts.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {opts.hint && <span className="mt-1 block text-[0.7rem] text-dust">{opts.hint}</span>}
    </label>
  );

  return (
    <div className="space-y-4" data-panel="event">
      <p className="text-sm text-dust">
        Everything here is specific to your event. Changes appear on the site as soon as you save.
        {readOnly && " Your account is read-only, so you can look but not change anything."}
      </p>

      <Section title="Basics" hint="Name, dates and who's running it" open>
        <div className="grid gap-4 md:grid-cols-2">
          {text("Event name", draft.name, (v) => set("name", v))}
          {text("Word to highlight in the name", draft.accentWord, (v) => set("accentWord", v), {
            hint: "One word from the name, drawn in the accent colour. Optional.",
          })}
          {text("Tagline", draft.tagline, (v) => set("tagline", v))}
          {text("Dates", draft.dates, (v) => set("dates", v), { hint: "Shown as written, e.g. March 5 – 7, 2027." })}
          {text("Submission deadline", draft.submissionDeadline, (v) => set("submissionDeadline", v), {
            hint: "Shown as written. Closing the form is a separate switch on the Home tab.",
          })}
          {text("Judging opens", draft.judgingOpens, (v) => set("judgingOpens", v))}
          {text("Format", draft.format, (v) => set("format", v), { placeholder: "In person · Online · Hybrid" })}
          {text("Prizes", draft.prizes, (v) => set("prizes", v))}
          {text("Host name", draft.host.name, (v) => set("host", { ...draft.host, name: v }))}
          {text("Host website", draft.host.url, (v) => set("host", { ...draft.host, url: v }))}
          {text("Contact email", draft.contactEmail, (v) => set("contactEmail", v), {
            hint: "Shown to participants who need help.",
          })}
          {text("Page teams tag when announcing", draft.announceUrl, (v) => set("announceUrl", v))}
          <label className="block">
            <span className="field-label">Largest team size</span>
            <select
              className="field-input mt-1"
              value={draft.maxTeamSize}
              disabled={disabled}
              onChange={(e) => set("maxTeamSize", Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4">
          {text("Description for search engines and link previews", draft.description, (v) => set("description", v), { area: 2 })}
        </div>
      </Section>

      <Section title="Look" hint="Accent colour and logo">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="field-label">Accent colour</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                type="color"
                className="h-11 w-14 cursor-pointer rounded-md border border-line bg-ink-5 p-1"
                value={/^#[0-9a-fA-F]{6}$/.test(draft.theme.accent) ? draft.theme.accent : "#662EFF"}
                disabled={disabled}
                onChange={(e) => set("theme", { ...draft.theme, accent: e.target.value })}
              />
              <input
                className="field-input"
                data-accent
                value={draft.theme.accent}
                disabled={disabled}
                onChange={(e) => set("theme", { ...draft.theme, accent: e.target.value })}
              />
            </span>
            <span className="mt-1 block text-[0.7rem] text-dust">
              Used for buttons, links and highlights. Pick one that reads well on both a dark and
              a light background.
            </span>
          </label>
          <div>
            {text("Logo address", draft.theme.logoUrl, (v) => set("theme", { ...draft.theme, logoUrl: v }), {
              placeholder: "https://…",
              hint: "A square image works best. Leave empty to show the Dua mark. Use PNG or JPEG if you send email: Gmail won't show SVG.",
            })}
            {!readOnly && (
              <label className="btn mt-2 cursor-pointer">
                {uploading ? "Uploading…" : "Upload an image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  className="hidden"
                  disabled={disabled || uploading}
                  onChange={(e) => uploadLogo(e.target.files?.[0])}
                />
              </label>
            )}
          </div>
        </div>
      </Section>

      <Section title="Judging" hint={`${criteria.length} criteria · top ${draft.topN} places`}>
        <label className="block max-w-xs">
          <span className="field-label">Places in the final ranking</span>
          <input
            type="number"
            min={1}
            max={20}
            className="field-input mt-1"
            value={draft.topN}
            disabled={disabled}
            onChange={(e) => set("topN", Number(e.target.value))}
          />
        </label>

        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
          <div className="field-label">Rubric</div>
          <div
            data-weight-total
            className={`text-xs ${weightTotal === 100 ? "text-jade" : "text-blood"}`}
          >
            Weights add up to {weightTotal} (must be 100)
          </div>
        </div>
        <p className="mt-1 text-[0.7rem] text-dust">
          Judges give each criterion a score from 1 to 5 with a sentence of evidence. Ties are
          settled by the ticked criteria, in the order listed.
        </p>
        {rubricLocked && (
          <div className="mt-2 rounded-md border border-line bg-ink-4 px-3 py-2 text-xs text-dust">
            Judges have started scoring, so criteria can&apos;t be added, removed or re-weighted.
            Names and guidance can still be edited.
          </div>
        )}

        <div className="mt-3 space-y-3">
          {criteria.map((c, i) => (
            <div key={i} className="rounded-md border border-line bg-ink-4 p-3" data-criterion-row>
              <div className="grid gap-3 md:grid-cols-[1fr_7rem_auto]">
                <label className="block">
                  <span className="field-label">Name</span>
                  <input
                    className="field-input mt-1"
                    value={c.label}
                    disabled={disabled}
                    onChange={(e) =>
                      editCriterion(i, {
                        label: e.target.value,
                        // A new criterion's id follows its name until it's saved.
                        ...(saved.rubric.criteria.some((s) => s.key === c.key) || rubricLocked
                          ? {}
                          : { key: uniqueKey(slug(e.target.value), criteria, i) }),
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="field-label">Weight %</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="field-input mt-1"
                    value={c.weight}
                    disabled={disabled || rubricLocked}
                    onChange={(e) => editCriterion(i, { weight: Number(e.target.value) })}
                  />
                </label>
                <div className="flex items-end gap-1">
                  <button type="button" className="btn" disabled={disabled || i === 0} onClick={() => moveCriterion(i, -1)} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" className="btn" disabled={disabled || i === criteria.length - 1} onClick={() => moveCriterion(i, 1)} aria-label="Move down">
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={disabled || rubricLocked || criteria.length === 1}
                    onClick={() => setRubric(criteria.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-dust">
                <input
                  type="checkbox"
                  checked={draft.rubric.tieBreakers.includes(c.key)}
                  disabled={disabled}
                  onChange={() => toggleTie(c.key)}
                />
                Use to settle ties
              </label>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-dust hover:text-bone">Guidance for judges</summary>
                <div className="mt-2 grid gap-2">
                  {(["limited", "solid", "exceptional"] as const).map((level, n) => (
                    <label key={level} className="block">
                      <span className="field-label">What a {n * 2 + 1} looks like</span>
                      <input
                        className="field-input mt-1"
                        value={c.anchors[level]}
                        disabled={disabled}
                        onChange={(e) => editCriterion(i, { anchors: { ...c.anchors, [level]: e.target.value } })}
                      />
                    </label>
                  ))}
                  <label className="block">
                    <span className="field-label">Example evidence sentence</span>
                    <input
                      className="field-input mt-1"
                      value={c.example}
                      disabled={disabled}
                      onChange={(e) => editCriterion(i, { example: e.target.value })}
                    />
                  </label>
                </div>
              </details>
            </div>
          ))}
        </div>
        {!readOnly && !rubricLocked && criteria.length < 10 && (
          <button type="button" className="btn mt-3" onClick={addCriterion} disabled={pending}>
            + Add a criterion
          </button>
        )}
      </Section>

      <Section
        title="Questions"
        hint={`${draft.customFields.registration.length + draft.customFields.submission.length} of your own · ${draft.hidden.registration.length + draft.hidden.submission.length} switched off`}
      >
        <p className="text-[0.7rem] text-dust">
          Switch off built-in questions your event doesn&apos;t need, and add your own. Names,
          emails and the project&apos;s title and description are always asked.
        </p>
        {(["registration", "submission"] as FormName[]).map((form) => (
          <div key={form} className="mt-5" data-questions={form}>
            <div className="field-label">
              {form === "registration" ? "Registration form" : "Submission form"}
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {HIDEABLE[form].map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm text-bone">
                  <input
                    type="checkbox"
                    data-ask={h.id}
                    checked={!draft.hidden[form].includes(h.id)}
                    disabled={disabled}
                    onChange={(e) =>
                      set("hidden", {
                        ...draft.hidden,
                        [form]: e.target.checked
                          ? draft.hidden[form].filter((id) => id !== h.id)
                          : [...draft.hidden[form], h.id],
                      })
                    }
                  />
                  Ask: {h.label}
                </label>
              ))}
            </div>

            <div className="mt-4 text-xs text-dust">Your own questions</div>
            <Rows<CustomField>
              items={draft.customFields[form]}
              disabled={disabled}
              max={30}
              addLabel="+ Add a question"
              blank={{ key: "", label: "", type: "text", required: false, options: [], help: "", showToJudges: false }}
              onChange={(next) =>
                set("customFields", {
                  ...draft.customFields,
                  // A question's id follows its wording until it's first saved;
                  // after that it stays put so earlier answers keep their place.
                  [form]: next.map((f, i) =>
                    saved.customFields[form].some((s) => s.key === f.key && f.key !== "")
                      ? f
                      : { ...f, key: uniqueFieldKey(slug(f.label), next, i) },
                  ),
                })
              }
              render={(f, edit) => (
                <div className="grid gap-2">
                  <div className="grid gap-2 md:grid-cols-[1fr_12rem]">
                    {text("Question", f.label, (v) => edit({ label: v }))}
                    <label className="block">
                      <span className="field-label">Answer type</span>
                      <select
                        className="field-input mt-1"
                        value={f.type}
                        disabled={disabled}
                        onChange={(e) => edit({ type: e.target.value as CustomField["type"] })}
                      >
                        {CUSTOM_FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {(f.type === "select" || f.type === "checkboxes") &&
                    text("Options", f.options.join("\n"), (v) => edit({ options: v.split("\n") }), {
                      area: 3,
                      hint: "One per line.",
                    })}
                  {text("Help text", f.help, (v) => edit({ help: v }), { hint: "Optional. Shown under the question." })}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-bone">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={f.required} disabled={disabled} onChange={(e) => edit({ required: e.target.checked })} />
                      Required
                    </label>
                    {form === "submission" && (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={f.showToJudges} disabled={disabled} onChange={(e) => edit({ showToJudges: e.target.checked })} />
                        Show the answer to judges
                      </label>
                    )}
                  </div>
                  {form === "submission" && f.showToJudges && (
                    <p className="text-[0.7rem] text-dust">
                      Don&apos;t ask for contact details in a question judges can see.
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        ))}
      </Section>

      <Section title="Form options" hint="The choices offered in dropdowns and checklists">
        <p className="mb-3 text-[0.7rem] text-dust">One option per line.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {LISTS.map((l) => (
            <label key={l.key} className="block">
              <span className="field-label">{l.label}</span>
              <textarea
                rows={Math.min(8, Math.max(3, draft[l.key].length + 1))}
                className="field-input mt-1 text-xs"
                data-list={l.key}
                value={draft[l.key].join("\n")}
                disabled={disabled}
                onChange={(e) => set(l.key, e.target.value.split("\n"))}
              />
              <span className="mt-1 block text-[0.7rem] text-dust">{l.hint}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Homepage" hint="The copy visitors read first">
        <div className="grid gap-4">
          {text("Introduction heading", draft.home.introTitle, (v) => setHome("introTitle", v))}
          {text("Introduction", draft.home.intro, (v) => setHome("intro", v), {
            area: 6,
            hint: "Leave a blank line between paragraphs. Leave empty to hide the section.",
          })}
        </div>

        <div className="mt-5 field-label">Highlights</div>
        <p className="text-[0.7rem] text-dust">Up to six cards, each with an example that opens when clicked.</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {text("Small heading", draft.home.pillarsEyebrow, (v) => setHome("pillarsEyebrow", v))}
          {text("Heading", draft.home.pillarsTitle, (v) => setHome("pillarsTitle", v))}
          {text("Line under the heading", draft.home.pillarsSubtitle, (v) => setHome("pillarsSubtitle", v))}
        </div>
        <Rows
          items={draft.home.pillars}
          disabled={disabled}
          max={6}
          addLabel="+ Add a highlight"
          blank={{ title: "", text: "", example: "" }}
          onChange={(v) => setHome("pillars", v)}
          render={(p, edit) => (
            <div className="grid gap-2">
              {text("Title", p.title, (v) => edit({ title: v }))}
              {text("Text", p.text, (v) => edit({ text: v }))}
              {text("Example", p.example, (v) => edit({ example: v }), { area: 2 })}
            </div>
          )}
        />

        <div className="mt-5 field-label">An example problem for each track</div>
        <div className="mt-2 grid gap-3">
          {draft.tracks.filter((t) => t.trim()).map((track) => {
            const current = draft.home.trackExamples.find((t) => t.track === track)?.example ?? "";
            return (
              <div key={track}>
                {text(track, current, (v) =>
                  setHome("trackExamples", [
                    ...draft.home.trackExamples.filter((t) => t.track !== track),
                    ...(v.trim() ? [{ track, example: v }] : []),
                  ]),
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 field-label">Questions and answers</div>
        <Rows
          items={draft.home.faq}
          disabled={disabled}
          max={30}
          addLabel="+ Add a question"
          blank={{ q: "", a: "" }}
          onChange={(v) => setHome("faq", v)}
          render={(f, edit) => (
            <div className="grid gap-2">
              {text("Question", f.q, (v) => edit({ q: v }))}
              {text("Answer", f.a, (v) => edit({ a: v }), { area: 2 })}
            </div>
          )}
        />
      </Section>

      {!readOnly && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-3 p-3 shadow-card">
          <button className="btn-accent" onClick={save} disabled={pending || !dirty} data-save-settings>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button className="btn" onClick={() => { setDraft(saved); setResult(null); }} disabled={pending || !dirty}>
            Discard
          </button>
          <span className={`text-xs ${result ? (result.ok ? "text-jade" : "text-blood") : "text-dust"}`} data-save-result>
            {result ? result.message : dirty ? "You have unsaved changes." : "No changes to save."}
          </span>
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<CustomField["type"], string> = {
  text: "Short text",
  textarea: "Long text",
  select: "Pick one",
  checkboxes: "Pick any",
  url: "Link",
};

function uniqueFieldKey(base: string, fields: CustomField[], self: number): string {
  let key = base === "criterion" ? "question" : base;
  for (let n = 2; fields.some((f, j) => j !== self && f.key === key); n++) key = `${base.slice(0, 27)}_${n}`;
  return key;
}

function uniqueKey(base: string, criteria: Criterion[], self: number): string {
  let key = base;
  for (let n = 2; criteria.some((c, j) => j !== self && c.key === key); n++) key = `${base.slice(0, 27)}_${n}`;
  return key;
}

function Section({
  title,
  hint,
  open,
  children,
}: {
  title: string;
  hint: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="card group" open={open} data-section={title}>
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-bold text-bone">
          <span className="mr-2 inline-block text-accent transition group-open:rotate-90">▸</span>
          {title}
        </span>
        <span className="text-xs text-dust">{hint}</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

/** A list of small forms with add and remove. */
function Rows<T>({
  items,
  onChange,
  render,
  blank,
  addLabel,
  max,
  disabled,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  render: (item: T, edit: (patch: Partial<T>) => void) => ReactNode;
  blank: T;
  addLabel: string;
  max: number;
  disabled: boolean;
}) {
  return (
    <div className="mt-2 space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-line bg-ink-4 p-3">
          {render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <button
            type="button"
            className="btn mt-2"
            disabled={disabled}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      {!disabled && items.length < max && (
        <button type="button" className="btn" onClick={() => onChange([...items, blank])}>
          {addLabel}
        </button>
      )}
    </div>
  );
}
