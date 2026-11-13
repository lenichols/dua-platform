import { describe, expect, it } from "vitest";
import { customAnswerRows, parseCustomAnswers } from "./custom-fields";
import {
  DEFAULT_SETTINGS,
  HIDEABLE,
  hiddenColumns,
  resolveSettings,
  settingsSchema,
  type CustomField,
} from "./event-settings";
import { registrationSchemaFor } from "./registration-schema";
import { submissionSchema, submissionSchemaFor } from "./submission-schema";

const field = (over: Partial<CustomField> & { key: string }): CustomField => ({
  label: over.key,
  type: "text",
  required: false,
  options: [],
  help: "",
  showToJudges: false,
  ...over,
});

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseCustomAnswers", () => {
  const fields = [
    field({ key: "tshirt", label: "T-shirt size", type: "select", options: ["S", "M", "L"], required: true }),
    field({ key: "diet", label: "Dietary needs", type: "checkboxes", options: ["Vegan", "Halal", "Gluten-free"] }),
    field({ key: "repo", label: "Repository", type: "url" }),
    field({ key: "why", label: "Why are you joining?", type: "textarea" }),
  ];

  it("keeps answers to the event's questions and ignores anything else", () => {
    const r = parseCustomAnswers(
      fields,
      form([
        ["custom.tshirt", "M"],
        ["custom.diet", "Vegan"],
        ["custom.diet", "Halal"],
        ["custom.repo", "https://example.org/repo"],
        ["custom.why", "  To learn.  "],
        ["custom.is_admin", "true"],
        ["full_name", "Sam"],
      ]),
    );
    expect(r).toEqual({
      ok: true,
      values: { tshirt: "M", diet: "Vegan, Halal", repo: "https://example.org/repo", why: "To learn." },
    });
  });

  it("requires required questions and leaves optional ones out when blank", () => {
    const missing = parseCustomAnswers(fields, form([["custom.why", "x"]]));
    expect(missing).toEqual({ ok: false, fieldErrors: { "custom.tshirt": ["T-shirt size is required"] } });
    const fine = parseCustomAnswers(fields, form([["custom.tshirt", "S"], ["custom.repo", "  "]]));
    expect(fine).toEqual({ ok: true, values: { tshirt: "S" } });
  });

  it("refuses a choice that isn't one of the options", () => {
    expect(parseCustomAnswers(fields, form([["custom.tshirt", "XXXL"]])).ok).toBe(false);
    expect(
      parseCustomAnswers(fields, form([["custom.tshirt", "S"], ["custom.diet", "Vegan"], ["custom.diet", "Anything"]])).ok,
    ).toBe(false);
  });

  it("takes only one choice for a pick-one question", () => {
    const r = parseCustomAnswers(fields, form([["custom.tshirt", "S"], ["custom.tshirt", "L"]]));
    expect(r).toEqual({ ok: true, values: { tshirt: "S" } });
  });

  it("checks links and length", () => {
    const base: [string, string][] = [["custom.tshirt", "S"]];
    expect(parseCustomAnswers(fields, form([...base, ["custom.repo", "javascript:alert(1)"]])).ok).toBe(false);
    expect(parseCustomAnswers(fields, form([...base, ["custom.repo", "example.org"]])).ok).toBe(false);
    expect(parseCustomAnswers(fields, form([...base, ["custom.why", "x".repeat(4001)]])).ok).toBe(false);
  });

  it("returns nothing for an event with no questions of its own", () => {
    expect(parseCustomAnswers([], form([["custom.anything", "x"]]))).toEqual({ ok: true, values: {} });
  });
});

describe("customAnswerRows", () => {
  const fields = [
    field({ key: "stack", label: "Tech stack", showToJudges: true }),
    field({ key: "phone2", label: "Second phone number" }),
    field({ key: "blank", label: "Unanswered", showToJudges: true }),
  ];
  const answers = { stack: "Rust", phone2: "+1 555 0100", gone: "from a removed question" };

  it("lists answers in the form's order, skipping blanks and removed questions", () => {
    expect(customAnswerRows(fields, answers).map((r) => [r.label, r.value])).toEqual([
      ["Tech stack", "Rust"],
      ["Second phone number", "+1 555 0100"],
    ]);
  });

  it("gives judges only the questions marked for them", () => {
    expect(customAnswerRows(fields, answers, { judgesOnly: true }).map((r) => r.key)).toEqual(["stack"]);
    expect(customAnswerRows(fields, null, { judgesOnly: true })).toEqual([]);
  });
});

describe("questions in the event's settings", () => {
  it("need options for choice questions, and a key each", () => {
    const base = { ...DEFAULT_SETTINGS, hidden: { registration: [], submission: [] } };
    const withFields = (fields: CustomField[]) =>
      settingsSchema.safeParse({ ...base, customFields: { registration: fields, submission: [] } }).success;
    expect(withFields([field({ key: "a", type: "select", options: ["x"] })])).toBe(true);
    expect(withFields([field({ key: "a", type: "select" })])).toBe(false);
    expect(withFields([field({ key: "a" }), field({ key: "a" })])).toBe(false);
    expect(withFields([field({ key: "Not A Key" })])).toBe(false);
  });

  it("can only switch off questions that are meant to be optional", () => {
    const s = resolveSettings({ hidden: { registration: ["referred_by", "email"], submission: ["mentor", "project_name"] } });
    expect(s.hidden).toEqual({ registration: ["referred_by"], submission: ["mentor"] });
    expect(hiddenColumns(s, "submission")).toEqual(new Set(["mentor_name", "mentor_linkedin_url"]));
    expect(hiddenColumns(DEFAULT_SETTINGS, "submission").size).toBe(0);
  });

  it("only offers to switch off columns that exist on the form", () => {
    for (const h of HIDEABLE.submission)
      for (const c of h.columns) expect(Object.keys(submissionSchema.shape)).toContain(c);
  });
});

describe("form rules with questions switched off", () => {
  const registration = {
    full_name: "Sam Example",
    email: "sam@example.org",
    phone: "+1 555 0100",
    country: "Canada",
    participating_as: "Solo",
    linkedin_url: "https://example.org/in/sam",
  };

  it("stop requiring a registration question once it's off, and no sooner", () => {
    const all = new Set(HIDEABLE.registration.flatMap((h) => [...h.columns]));
    expect(registrationSchemaFor(new Set()).safeParse(registration).success).toBe(false);
    expect(registrationSchemaFor(all).safeParse(registration).success).toBe(true);
    const butOne = new Set([...all].filter((c) => c !== "referred_by"));
    expect(registrationSchemaFor(butOne).safeParse(registration).success).toBe(false);
  });

  it("keep the rules that aren't switchable", () => {
    const all = new Set(HIDEABLE.registration.flatMap((h) => [...h.columns]));
    expect(registrationSchemaFor(all).safeParse({ ...registration, email: "nope" }).success).toBe(false);
    expect(registrationSchemaFor(all).safeParse({ ...registration, linkedin_url: "" }).success).toBe(false);
    expect(
      registrationSchemaFor(all).safeParse({ ...registration, participating_as: "Team", team_name: "" }).success,
    ).toBe(false);
  });

  it("do the same for submissions", () => {
    const entry = {
      member1_name: "Ada Example",
      member1_email: "ada@example.org",
      phone: "+1 555 0100",
      country: "Canada",
      solo_or_team: "Solo",
      project_name: "Notebook",
      project_category: "Notes",
      problem_statement: "Students lose track of their notes across several different apps.",
      project_description: "One place for notes that works without a connection, built in a weekend.",
      project_description_summary: "Offline notes",
      technologies_used: "TypeScript",
    };
    const all = new Set(HIDEABLE.submission.flatMap((h) => [...h.columns]));
    expect(submissionSchemaFor(new Set()).safeParse(entry).success).toBe(false);
    const relaxed = submissionSchemaFor(all).safeParse(entry);
    expect(relaxed.success).toBe(true);
    expect(relaxed.success && relaxed.data.linkedin_post_url).toBe("");
    expect(submissionSchemaFor(all).safeParse({ ...entry, project_name: "" }).success).toBe(false);
  });
});
