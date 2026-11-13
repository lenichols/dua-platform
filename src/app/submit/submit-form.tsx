"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitProject, updateSubmission, type SubmitResult } from "./actions";
import { COUNTRIES } from "@/lib/countries";
import { CustomFields } from "@/components/custom-fields";
import { useEvent } from "@/components/event-context";
import { customFieldName } from "@/lib/custom-fields";
import { hiddenQuestions } from "@/lib/event-settings";

function formatPhone(v: string) {
  let s = v.replace(/[^\d+()\-\s]/g, "");
  s = s.replace(/(?!^)\+/g, "");
  return s.slice(0, 25);
}

const OTHER = "Other";

// Word limits the server enforces; counted the same way it counts.
const WORD_LIMITS = {
  problem_statement: 250,
  project_description: 500,
  disclosure_statement: 250,
} as const;
type WordField = keyof typeof WORD_LIMITS;
const countWords = (v: string) => v.trim().split(/\s+/).filter(Boolean).length;

// "member2_linkedin_url" → "Member 2 linkedin url", for the error list.
function fieldLabel(name: string) {
  const s = name.replace(/^member(\d)_/, "member $1 ").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A saved value for a select-with-"Other…": the listed option, or Other
// (its free-text box then gets the value from the prefill below).
function choiceFor(list: string[], v: string | undefined) {
  if (!v) return "";
  return list.includes(v) ? v : OTHER;
}

export function SubmitForm({
  initial,
  initialCustom,
  edit,
}: {
  /** Saved values, keyed by field name, when editing via an edit link. */
  initial?: Record<string, string>;
  /** Saved answers to the organizer's own questions, when editing. */
  initialCustom?: Record<string, string>;
  edit?: { id: string; token: string };
} = {}) {
  const EVENT = useEvent();
  // Built-in questions the organizer has switched off in the Event tab.
  const off = hiddenQuestions(EVENT, "submission");
  const shown = (id: string) => !off.has(id);
  const {
    tracks: TRACKS,
    problemBriefs: PROBLEM_BRIEFS,
    focusAreas: FOCUS_AREAS,
    impactFocus: IMPACT_FOCUS,
    regions: REGIONS,
    areasOfSpecification: AREAS_OF_SPECIFICATION,
    solutionStages: SOLUTION_STAGES,
    affiliations: ORGS,
    roles: ROLES,
  } = EVENT;
  const [state, setState] = useState<SubmitResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [mode, setMode] = useState<"Solo" | "Team">(
    initial?.solo_or_team === "Team" ? "Team" : "Solo",
  );
  const [orgChoice, setOrgChoice] = useState<string>(
    choiceFor(ORGS, initial?.affiliated_org),
  );
  const [roleChoice, setRoleChoice] = useState<string>(
    choiceFor(ROLES, initial?.submitter_role),
  );
  const [sectorChoice, setSectorChoice] = useState<string>(
    choiceFor(FOCUS_AREAS, initial?.focus_area),
  );
  const [areaChoice, setAreaChoice] = useState<string>(
    choiceFor(AREAS_OF_SPECIFICATION, initial?.area_of_specification),
  );
  const [phone, setPhone] = useState<string>(initial?.phone ?? "");
  const [impactSel, setImpactSel] = useState<string[]>(
    (initial?.impact_focus ?? "")
      .split(",")
      .map((f) => f.trim())
      .filter((f) => IMPACT_FOCUS.includes(f)),
  );

  const [words, setWords] = useState<Record<WordField, number>>(() => ({
    problem_statement: countWords(initial?.problem_statement ?? ""),
    project_description: countWords(initial?.project_description ?? ""),
    disclosure_statement: countWords(initial?.disclosure_statement ?? ""),
  }));
  const trackWords = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.currentTarget;
    setWords((w) => ({ ...w, [name]: countWords(value) }));
  };
  const wordCount = (f: WordField) => (
    <p
      className={`mt-1 text-right text-xs ${
        words[f] > WORD_LIMITS[f] ? "font-semibold text-blood" : "text-dust"
      }`}
    >
      {words[f]} / {WORD_LIMITS[f]} words
    </p>
  );

  // Fill every named field from the saved submission once it has rendered.
  // Going by name covers all ~70 fields without threading defaultValue
  // through each one; the controlled fields above already hold the same
  // values, so writing them here is a no-op.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (!initial || !form) return;
    for (const [name, value] of Object.entries(initial)) {
      const el = form.elements.namedItem(name);
      if (!el) continue;
      if (el instanceof RadioNodeList) {
        el.forEach((node) => {
          if (node instanceof HTMLInputElement && node.type === "radio")
            node.checked = node.value === value;
        });
      } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
        el.checked = value === el.value;
      } else if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        el.value = value;
      }
    }
    // Saved values only matter on first render; later edits are the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleImpact = (f: string) =>
    setImpactSel((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );

  // Captured FormData → modal preview (null means no modal)
  const [pending_fd, setPendingFd] = useState<FormData | null>(null);
  // Errors render beside their fields, which can be far up the page from
  // the submit button, so bring the first one into view.
  useEffect(() => {
    if (state?.ok !== false || !state.fieldErrors) return;
    const first = formRef.current?.querySelector("p.text-blood");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  if (state?.ok) {
    return (
      <div className="card">
        <div className="pill-accent mb-4">
          {state.updated ? "✓ Changes saved" : "✓ Submitted"}
        </div>
        <h2 className="hex-title text-4xl">
          {state.updated ? "All Set." : "You're In."}
        </h2>
        <p className="mt-3 text-dust">
          {state.updated
            ? "Your submission has been updated. Judges will see the new version."
            : "Your project has been locked in for judging. We've also emailed you this edit link."}{" "}
          Use it to make changes until submissions close (
          {EVENT.submissionDeadline}). Anyone with the link can edit your
          submission, so share it only with your team.
        </p>
        <EditLinkBox url={state.editUrl} />
        <p className="mt-3 text-xs text-dust">
          Submission ID:{" "}
          <span className="font-mono text-accent">{state.id}</span>
        </p>
      </div>
    );
  }

  const fe = state?.ok === false ? (state.fieldErrors ?? {}) : {};

  const err = (k: string) =>
    fe[k]?.[0] ? <p className="mt-1 text-xs text-blood">{fe[k]![0]}</p> : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Browser already validated native required fields before we got here, but
    // Impact Focus is a custom checkbox group (hidden input) the browser can't
    // enforce — guard it here so we don't open the review modal with it empty.
    const fd = new FormData(e.currentTarget);
    const errors: Record<string, string[]> = {};
    if (shown("impact_focus") && impactSel.length === 0)
      errors.impact_focus = ["Select at least one impact focus"];
    for (const f of Object.keys(WORD_LIMITS) as WordField[]) {
      const n = countWords(String(fd.get(f) ?? ""));
      if (n > WORD_LIMITS[f])
        errors[f] = [`${n} words — trim it to ${WORD_LIMITS[f]} or fewer`];
    }
    if (Object.keys(errors).length > 0) {
      setState({
        ok: false,
        error: "Some answers need fixing:",
        fieldErrors: errors,
      });
      return;
    }
    setPendingFd(fd);
  }

  function cancelConfirm() {
    setPendingFd(null);
  }

  function confirmAndSend() {
    if (!pending_fd) return;
    const fd = pending_fd;
    startTransition(async () => {
      const result = edit
        ? await updateSubmission(edit.id, edit.token, fd)
        : await submitProject(null, fd);
      setState(result);
      // Only close the modal if it succeeded — on error, keep it open
      // briefly so the user sees what happened, then auto-close so the
      // inline field errors can render.
      setPendingFd(null);
    });
  }

  const preview: Record<string, string> | null = pending_fd
    ? (() => {
        const o: Record<string, string> = {};
        pending_fd.forEach((v, k) => {
          // A question with several boxes ticked posts one value per box.
          o[k] = k.startsWith("custom.") && o[k] ? `${o[k]}, ${v}` : String(v);
        });
        return o;
      })()
    : null;

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Contestant */}
        <fieldset className="card space-y-4">
          <legend className="pill-accent -mt-2 mb-2">About You</legend>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">Full Legal Name *</label>
              <input
                name="member1_name"
                required
                className="field-input mt-1"
              />
              {err("member1_name")}
            </div>
            <div>
              <label className="field-label">Email Address *</label>
              <input
                name="member1_email"
                type="email"
                required
                autoComplete="email"
                className="field-input mt-1"
              />
              {err("member1_email")}
            </div>
            {shown("phone") && (
              <div>
                <label className="field-label">Phone Number *</label>
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="+1 (555) 123-4567"
                  className="field-input mt-1"
                />
                {err("phone")}
              </div>
            )}
            {shown("location") && (
              <div>
                <label className="field-label">Country *</label>
                <select
                  name="country"
                  required
                  defaultValue=""
                  autoComplete="country-name"
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {err("country")}
              </div>
            )}
            {shown("location") && (
              <div>
                <label className="field-label">State / Province / Region</label>
                <input
                  name="state_region"
                  autoComplete="address-level1"
                  placeholder="e.g. California · Lagos · Bavaria"
                  className="field-input mt-1"
                />
              </div>
            )}
            {shown("location") && (
              <div>
                <label className="field-label">City</label>
                <input
                  name="city"
                  autoComplete="address-level2"
                  className="field-input mt-1"
                />
              </div>
            )}
            {shown("submitter_profile") && (
              <div>
                <label className="field-label">Affiliated Org</label>
                <select
                  value={orgChoice}
                  onChange={(e) => setOrgChoice(e.target.value)}
                  name={orgChoice === OTHER ? undefined : "affiliated_org"}
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  {ORGS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  <option value={OTHER}>Other…</option>
                </select>
                {orgChoice === OTHER && (
                  <input
                    name="affiliated_org"
                    required
                    placeholder="Type your org"
                    className="field-input mt-2"
                    autoFocus
                  />
                )}
              </div>
            )}
            {shown("submitter_profile") && (
              <div>
                <label className="field-label">Role</label>
                <select
                  value={roleChoice}
                  onChange={(e) => setRoleChoice(e.target.value)}
                  name={roleChoice === OTHER ? undefined : "submitter_role"}
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value={OTHER}>Other…</option>
                </select>
                {roleChoice === OTHER && (
                  <input
                    name="submitter_role"
                    required
                    placeholder="Type your role"
                    className="field-input mt-2"
                    autoFocus
                  />
                )}
              </div>
            )}
            {shown("submitter_profile") && (
              <div className="md:col-span-2">
                <label className="field-label">LinkedIn Profile URL</label>
                <input
                  name="submitter_linkedin_url"
                  placeholder="https://linkedin.com/in/..."
                  className="field-input mt-1"
                />
                {err("submitter_linkedin_url")}
              </div>
            )}
          </div>
        </fieldset>

        {/* Team */}
        <fieldset className="card space-y-4">
          <legend className="pill-accent -mt-2 mb-2">Team</legend>
          <div className="flex gap-2">
            {(["Solo", "Team"] as const).map((opt) => (
              <label
                key={opt}
                className={`flex-1 cursor-pointer rounded-md border px-4 py-3 text-center text-sm transition ${
                  mode === opt
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line bg-ink-4 text-dust hover:border-accent/60"
                }`}
              >
                <input
                  type="radio"
                  name="solo_or_team"
                  value={opt}
                  checked={mode === opt}
                  onChange={() => setMode(opt)}
                  className="sr-only"
                />
                {opt}
              </label>
            ))}
          </div>

          {mode === "Team" && (
            <div className="space-y-4">
              <div>
                <label className="field-label">Team Name *</label>
                <input name="team_name" required className="field-input mt-1" />
              </div>

              {[2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className="rounded-md border border-line bg-ink-4/40 p-3"
                >
                  <div className="field-label mb-2">
                    Member {n} <span className="text-dust">(optional)</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="field-label">Full Name</label>
                      <input
                        name={`member${n}_name`}
                        className="field-input mt-1"
                      />
                    </div>
                    <div>
                      <label className="field-label">Email</label>
                      <input
                        name={`member${n}_email`}
                        type="email"
                        className="field-input mt-1"
                      />
                      {err(`member${n}_email`)}
                    </div>
                    {shown("teammate_details") && (
                      <div>
                        <label className="field-label">LinkedIn Profile</label>
                        <input
                          name={`member${n}_linkedin_url`}
                          placeholder="https://linkedin.com/in/…"
                          className="field-input mt-1"
                        />
                        {err(`member${n}_linkedin_url`)}
                      </div>
                    )}
                    {shown("teammate_details") && (
                      <div>
                        <label className="field-label">Occupation</label>
                        <input
                          name={`member${n}_occupation`}
                          placeholder="e.g. Software Engineer, Student"
                          className="field-input mt-1"
                        />
                      </div>
                    )}
                    {shown("teammate_details") && (
                      <div>
                        <label className="field-label">
                          Country of Residence
                        </label>
                        <select
                          name={`member${n}_country`}
                          defaultValue=""
                          className="field-input mt-1"
                        >
                          <option value="">— Select —</option>
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="field-label">Team Size</label>
            <input
              name="team_size"
              type="number"
              min={1}
              max={10}
              defaultValue={mode === "Solo" ? 1 : 2}
              className="field-input mt-1 w-32"
            />
          </div>
        </fieldset>

        {/* Mentor */}
        {shown("mentor") && (
          <fieldset className="card space-y-4">
            <legend className="pill-accent -mt-2 mb-2">Mentor</legend>
            <p className="text-xs text-dust">
              If a mentor helped you during the build weekend, tell us who. List
              more than one by separating names with commas.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">
                  Mentor&apos;s Full Name{" "}
                  <span className="text-dust">(optional)</span>
                </label>
                <input name="mentor_name" className="field-input mt-1" />
                {err("mentor_name")}
              </div>
              <div>
                <label className="field-label">
                  Mentor&apos;s LinkedIn Profile
                </label>
                <input
                  name="mentor_linkedin_url"
                  type="url"
                  placeholder="https://linkedin.com/in/…"
                  className="field-input mt-1"
                />
                {err("mentor_linkedin_url")}
              </div>
            </div>
          </fieldset>
        )}

        {/* Project */}
        <fieldset className="card space-y-4">
          <legend className="pill-accent -mt-2 mb-2">Project</legend>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">Project Name *</label>
              <input
                name="project_name"
                required
                className="field-input mt-1"
              />
              {err("project_name")}
            </div>
            {shown("challenge_track") && (
              <div>
                <label className="field-label">Challenge Track *</label>
                <select
                  name="challenge_track"
                  required
                  className="field-input mt-1"
                  defaultValue=""
                >
                  <option value="">— Select —</option>
                  {TRACKS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {shown("problem_brief") && (
              <div className="md:col-span-2">
                <label className="field-label">Problem Brief *</label>
                <select
                  name="problem_brief"
                  required
                  className="field-input mt-1"
                  defaultValue=""
                >
                  <option value="">— Which brief did you work on? —</option>
                  {PROBLEM_BRIEFS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-dust">
                  Judges score you against your brief&apos;s success metrics.
                </p>
                {err("problem_brief")}
              </div>
            )}
            {shown("customer_type") && (
              <div>
                <label className="field-label">Who Is It For? *</label>
                <select
                  name="customer_type"
                  required
                  defaultValue=""
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  <option value="Individuals">
                    Individuals &amp; households
                  </option>
                  <option value="Organizations">
                    Organizations — businesses, nonprofits &amp; public bodies
                  </option>
                </select>
                {err("customer_type")}
              </div>
            )}
            {shown("region") && (
              <div>
                <label className="field-label">Your Region *</label>
                <select
                  name="region"
                  required
                  defaultValue=""
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {err("region")}
              </div>
            )}
            {shown("project_category") && (
              <div>
                <label className="field-label">Project Category *</label>
                <input
                  name="project_category"
                  required
                  placeholder="AI for Coding, Mental Health, …"
                  className="field-input mt-1"
                />
                {err("project_category")}
              </div>
            )}
            {shown("technologies_used") && (
              <div>
                <label className="field-label">Technologies Used *</label>
                <input
                  name="technologies_used"
                  required
                  placeholder="Python, React, Postgres, Raspberry Pi, …"
                  className="field-input mt-1"
                />
                {err("technologies_used")}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {shown("focus_area") && (
              <div>
                <label className="field-label">Focus Area *</label>
                <select
                  value={sectorChoice}
                  onChange={(e) => setSectorChoice(e.target.value)}
                  name={sectorChoice === OTHER ? undefined : "focus_area"}
                  required
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  {FOCUS_AREAS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value={OTHER}>Other…</option>
                </select>
                {sectorChoice === OTHER && (
                  <input
                    name="focus_area"
                    required
                    placeholder="Specify focus area"
                    className="field-input mt-2"
                    autoFocus
                  />
                )}
                {err("focus_area")}
              </div>
            )}
            {shown("solution_stage") && (
              <div>
                <label className="field-label">Solution Stage *</label>
                <select
                  name="solution_stage"
                  required
                  defaultValue=""
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  {SOLUTION_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {err("solution_stage")}
              </div>
            )}
            {shown("area_of_specification") && (
              <div>
                <label className="field-label">Area of Specification *</label>
                <select
                  value={areaChoice}
                  onChange={(e) => setAreaChoice(e.target.value)}
                  name={
                    areaChoice === OTHER ? undefined : "area_of_specification"
                  }
                  required
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  {AREAS_OF_SPECIFICATION.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  <option value={OTHER}>Other…</option>
                </select>
                {areaChoice === OTHER && (
                  <input
                    name="area_of_specification"
                    required
                    placeholder="Specify your area"
                    className="field-input mt-2"
                    autoFocus
                  />
                )}
                {err("area_of_specification")}
              </div>
            )}
            {shown("applies_ai") && (
              <div>
                <label className="field-label">
                  Will your solution apply AI? *
                </label>
                <select
                  name="applies_ai"
                  required
                  defaultValue=""
                  className="field-input mt-1"
                >
                  <option value="">— Select —</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                {err("applies_ai")}
              </div>
            )}
          </div>

          {shown("impact_focus") && (
            <div>
              <label className="field-label">
                Impact Focus *{" "}
                <span className="text-dust">(select all that apply)</span>
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {IMPACT_FOCUS.map((f) => {
                  const active = impactSel.includes(f);
                  return (
                    <label
                      key={f}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition ${
                        active
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line bg-ink-4 text-dust hover:border-accent/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleImpact(f)}
                        className="h-4 w-4 accent-accent"
                      />
                      {f}
                    </label>
                  );
                })}
              </div>
              <input
                type="hidden"
                name="impact_focus"
                value={impactSel.join(", ")}
              />
              {err("impact_focus")}
            </div>
          )}

          {shown("target_region") && (
            <div>
              <label className="field-label">Target Region / Market</label>
              <input
                name="target_region"
                placeholder="Where does your solution apply? e.g. Sub-Saharan Africa, rural South Asia"
                className="field-input mt-1"
              />
            </div>
          )}

          {shown("core_problem") && (
            <div>
              <label className="field-label">
                What is the core problem your project addresses? *
              </label>
              <input
                name="core_problem"
                required
                placeholder="e.g. Volunteer shifts go unfilled because nobody can see the gaps"
                className="field-input mt-1"
              />
              {err("core_problem")}
            </div>
          )}

          {shown("problem_statement") && (
            <div>
              <label className="field-label">
                Problem Statement *{" "}
                <span className="text-dust">(max 250 words)</span>
              </label>
              <textarea
                name="problem_statement"
                onInput={trackWords}
                required
                rows={5}
                minLength={30}
                placeholder="Explain the problem you chose: who has it, why it persists, and why it matters."
                className="field-input mt-1"
              />
              {wordCount("problem_statement")}
              {err("problem_statement")}
            </div>
          )}

          <div>
            <label className="field-label">
              Project Description *{" "}
              <span className="text-dust">(your solution — max 500 words)</span>
            </label>
            <textarea
              name="project_description"
              onInput={trackWords}
              required
              rows={5}
              minLength={30}
              className="field-input mt-1"
            />
            {wordCount("project_description")}
            {err("project_description")}
          </div>

          <div>
            <label className="field-label">
              One-Line Summary * (280 chars)
            </label>
            <input
              name="project_description_summary"
              required
              maxLength={280}
              className="field-input mt-1"
            />
            {err("project_description_summary")}
          </div>

          {shown("code_links") && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">GitHub URL</label>
                <input name="github_url" className="field-input mt-1" />
                {err("github_url")}
              </div>
              <div>
                <label className="field-label">Live Demo URL</label>
                <input name="live_demo_url" className="field-input mt-1" />
                {err("live_demo_url")}
              </div>
            </div>
          )}
        </fieldset>

        {/* Demo Video — prominent, red-accented */}
        {(shown("demo_video") || shown("pitch_video")) && (
          <fieldset className="card space-y-4 border-blood/50 bg-gradient-to-br from-blood/5 to-transparent">
            <legend className="inline-flex items-center gap-2 rounded-full border border-blood/60 bg-blood/20 px-3 py-1 text-[0.7rem] font-bold text-blood">
              ▣ Required · Demo Video
            </legend>

            <div className="rounded-md border border-blood/40 bg-ink-4/60 p-3 text-sm leading-relaxed">
              <div className="mb-1 text-xs font-bold text-blood">
                ⚠ Disqualification Notice
              </div>
              <p className="text-bone/90">
                A demonstration video <strong>must</strong> accompany this
                submission. <span className="text-accent">3 to 5 minutes.</span>{" "}
                Show <strong>all team members at least once</strong> in the
                video. Submissions with no demo video will be{" "}
                <strong className="text-blood">disqualified</strong>.
              </p>
            </div>

            {shown("demo_video") && (
              <div>
                <label className="field-label">
                  Demo Video — 3 to 5 minutes (YouTube / Vimeo / Loom) *
                </label>
                <input
                  name="demo_video_url"
                  type="url"
                  required
                  placeholder="https://youtu.be/…  ·  https://vimeo.com/…  ·  https://loom.com/share/…"
                  className="field-input mt-1"
                />
                {err("demo_video_url")}
              </div>
            )}

            {shown("pitch_video") && (
              <div>
                <label className="field-label">
                  Pitch Video — 3 to 5 minutes{" "}
                  <span className="text-dust">(optional)</span>
                </label>
                <input
                  name="demo_video_short_url"
                  type="url"
                  placeholder="Your recorded pitch: the problem, the solution's value, and a demonstration"
                  className="field-input mt-1"
                />
                {err("demo_video_short_url")}
              </div>
            )}

            {shown("demo_video") && (
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-ink-4 p-3 hover:border-accent/60">
                <input
                  type="checkbox"
                  name="all_members_in_video"
                  value="checked"
                  required
                  className="mt-0.5 h-5 w-5 accent-accent"
                />
                <span className="text-sm">
                  <span className="font-semibold text-bone">
                    I confirm all team members appear in the demo video. *
                  </span>
                  <span className="block text-xs text-dust">
                    Required. If a member is unavailable, please re-record or
                    contact the organizers before submitting.
                  </span>
                </span>
              </label>
            )}
          </fieldset>
        )}

        {/* Pitch materials + disclosure */}
        {shown("materials") && (
          <fieldset className="card space-y-4">
            <legend className="pill-accent -mt-2 mb-2">
              Pitch Deck, Summary &amp; Disclosure
            </legend>

            <p className="text-sm text-dust">
              Share each file as a link anyone can open (Google Drive, Dropbox,
              OneDrive…). Judges review these alongside your demo video.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Pitch Deck (PDF link) *</label>
                <input
                  name="pitch_deck_url"
                  type="url"
                  required
                  placeholder="Problem, solution, evidence, cost, scale, impact, team"
                  className="field-input mt-1"
                />
                {err("pitch_deck_url")}
              </div>
              <div>
                <label className="field-label">
                  One-Page Summary (PDF link) *
                </label>
                <input
                  name="summary_url"
                  type="url"
                  required
                  placeholder="Problem, users, solution, cost, 6–18 month plan"
                  className="field-input mt-1"
                />
                {err("summary_url")}
              </div>
            </div>

            <div>
              <label className="field-label">Disclosure Statement *</label>
              <p className="mt-1 text-xs text-dust">
                What existed before the event, and what you built during the
                sprint. List any AI tools, open-source code, and datasets you
                used. Prior work is allowed — it just has to be disclosed.
              </p>
              <textarea
                name="disclosure_statement"
                onInput={trackWords}
                required
                rows={4}
                minLength={20}
                className="field-input mt-1"
              />
              {wordCount("disclosure_statement")}
              {err("disclosure_statement")}
            </div>
          </fieldset>
        )}

        {/* LinkedIn Announcement */}
        {shown("announcement") && (
          <fieldset className="card space-y-4">
            <legend className="pill-accent -mt-2 mb-2">
              LinkedIn Announcement
            </legend>

            <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm">
              <span className="font-semibold text-accent">Required.</span> You,
              the submitter, must post on LinkedIn announcing your participation
              in
              {EVENT.name}, tagging the host:{" "}
              <a
                href={EVENT.announceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-bone underline decoration-accent/60 hover:text-accent"
              >
                {EVENT.host.name}
              </a>
              .
            </div>

            <div>
              <label className="field-label">LinkedIn Post URL *</label>
              <input
                name="linkedin_post_url"
                type="url"
                required
                placeholder="https://www.linkedin.com/posts/…"
                className="field-input mt-1"
              />
              {err("linkedin_post_url")}
            </div>
          </fieldset>
        )}

        <CustomFields
          fields={EVENT.customFields.submission}
          initial={initialCustom}
          errors={fe}
        />

        {state?.ok === false && (
          <div className="rounded-md border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-blood">
            {Object.keys(fe).length > 0 ? (
              <>
                <div className="font-semibold">Some answers need fixing:</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {Object.entries(fe).map(([k, msgs]) => (
                    <li key={k}>
                      <span className="font-semibold">{fieldLabel(k)}</span>:{" "}
                      {msgs?.[0]}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              state.error
            )}
          </div>
        )}

        <div className="flex justify-end gap-3">
          {/* Reset would blank the saved values, not restore them. */}
          {!edit && (
            <button type="reset" className="btn" disabled={pending}>
              Reset
            </button>
          )}
          <button type="submit" className="btn-accent" disabled={pending}>
            {pending
              ? edit
                ? "Saving…"
                : "Submitting…"
              : edit
                ? "Review & Save"
                : "Review & Submit"}
          </button>
        </div>
      </form>

      {preview && (
        <ConfirmModal
          values={preview}
          mode={mode}
          editing={!!edit}
          onCancel={cancelConfirm}
          onConfirm={confirmAndSend}
          pending={pending}
        />
      )}
    </>
  );
}

function EditLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-md border border-line bg-ink-4 p-3">
      <div className="field-label mb-1">Your private edit link</div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={url}
          className="min-w-0 flex-1 break-all font-mono text-xs text-accent underline"
        >
          {url}
        </a>
        <button
          type="button"
          className="pill shrink-0 hover:border-accent hover:text-accent"
          onClick={() =>
            navigator.clipboard?.writeText(url).then(() => setCopied(true))
          }
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({
  values,
  mode,
  editing,
  onCancel,
  onConfirm,
  pending,
}: {
  values: Record<string, string>;
  mode: "Solo" | "Team";
  editing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const custom = useEvent().customFields.submission;
  const row = (k: string, label: string) => {
    const v = values[k];
    if (!v || v.trim() === "") return null;
    return (
      <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5">
        <dt className="text-[0.7rem] text-dust">{label}</dt>
        <dd className="text-sm text-bone break-words">{v}</dd>
      </div>
    );
  };

  const members = [2, 3, 4, 5]
    .map((n) => values[`member${n}_name`])
    .filter((v) => v && v.trim() !== "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#081124]/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-2xl border-accent/60">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="pill-accent">Review Your Submission</div>
            <h2 className="hex-title mt-2 text-3xl">One Last Look</h2>
          </div>
          <div className="font-display text-5xl text-accent/30">⬡</div>
        </div>

        <p className="mb-4 text-sm text-dust">
          {editing
            ? "Confirming replaces your saved submission with these answers."
            : "Once confirmed, your submission is locked in for judging. You'll get a private edit link, on screen and by email, that works until submissions close."}
        </p>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto rounded-md border border-line bg-ink-4 p-4">
          <section>
            <div className="mb-2 text-xs font-bold text-accent">Submitter</div>
            <dl className="divide-y divide-line/60">
              {row("member1_name", "Name")}
              {row("member1_email", "Email")}
              {row("phone", "Phone")}
              {row("country", "Country")}
              {row("state_region", "State / Region")}
              {row("city", "City")}
              {row("affiliated_org", "Org")}
              {row("submitter_role", "Role")}
              {row("submitter_linkedin_url", "LinkedIn")}
            </dl>
          </section>

          <section>
            <div className="mb-2 text-xs font-bold text-accent">
              Team · {mode}
            </div>
            <dl className="divide-y divide-line/60">
              {mode === "Team" && row("team_name", "Team Name")}
              {row("team_size", "Size")}
              {members.length > 0 && (
                <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5">
                  <dt className="text-[0.7rem] text-dust">Members</dt>
                  <dd className="text-sm text-bone">{members.join(", ")}</dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <div className="mb-2 text-xs font-bold text-accent">Mentor</div>
            <dl className="divide-y divide-line/60">
              {row("mentor_name", "Name")}
              {row("mentor_linkedin_url", "LinkedIn")}
            </dl>
          </section>

          <section>
            <div className="mb-2 text-xs font-bold text-accent">Project</div>
            <dl className="divide-y divide-line/60">
              {row("project_name", "Name")}
              {row("challenge_track", "Track")}
              {row("problem_brief", "Problem Brief")}
              {row("customer_type", "Who It's For")}
              {row("region", "Region")}
              {row("project_category", "Category")}
              {row("focus_area", "Focus Area")}
              {row("area_of_specification", "Specification")}
              {row("solution_stage", "Stage")}
              {row("applies_ai", "Applies AI")}
              {row("impact_focus", "Impact Focus")}
              {row("target_region", "Target Region")}
              {row("core_problem", "Core Problem")}
              {row("technologies_used", "Tech")}
              {row("project_description_summary", "Summary")}
              {row("problem_statement", "Problem Statement")}
              {row("project_description", "Description")}
              {row("github_url", "GitHub")}
              {row("live_demo_url", "Live Demo")}
            </dl>
          </section>

          <section>
            <div className="mb-2 text-xs font-bold text-blood">
              ▣ Demo Video
            </div>
            <dl className="divide-y divide-line/60">
              {row("demo_video_url", "Video URL")}
              {row("demo_video_short_url", "Pitch Video")}
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5">
                <dt className="text-[0.7rem] text-dust">All Members</dt>
                <dd className="text-sm">
                  {values["all_members_in_video"] === "checked" ? (
                    <span className="text-jade">✓ Confirmed in video</span>
                  ) : (
                    <span className="text-blood">
                      ✗ Not confirmed (may be flagged for review)
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div className="mb-2 text-xs font-bold text-accent">
              Pitch Deck, Summary &amp; Disclosure
            </div>
            <dl className="divide-y divide-line/60">
              {row("pitch_deck_url", "Pitch Deck")}
              {row("summary_url", "One-Page Summary")}
              {row("disclosure_statement", "Disclosure")}
            </dl>
          </section>

          <section>
            <div className="mb-2 text-xs font-bold text-accent">
              LinkedIn Announcement
            </div>
            <dl className="divide-y divide-line/60">
              {row("linkedin_post_url", "Post URL")}
            </dl>
          </section>

          {custom.length > 0 && (
            <section>
              <div className="mb-2 text-xs font-bold text-accent">
                More About Your Entry
              </div>
              <dl className="divide-y divide-line/60">
                {custom.map((f) => (
                  <div key={f.key}>{row(customFieldName(f.key), f.label)}</div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="btn"
          >
            ← Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="btn-accent"
          >
            {pending
              ? editing
                ? "Saving…"
                : "Submitting…"
              : editing
                ? "✔ Confirm & Save"
                : "✔ Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
