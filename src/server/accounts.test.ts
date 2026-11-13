import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { judges, registrations, submissions } from "@/db/schema";
import {
  countOtherActiveOwners,
  createAdminUser,
  findAdminUserByEmail,
  listAdminUsers,
} from "@/lib/admin-users";
import { verifyAdminPassword } from "@/lib/admin-password";
import { submissionSchema, type SubmissionInput } from "@/lib/submission-schema";
import { ADMIN, VIEWER_ADMIN, makeEvent, makeJudge, makeSubmission, resetDb } from "../../test/fixtures";
import {
  checkJudgeSignIn,
  deactivateJudge,
  getActiveJudge,
  listJudges,
  setSharedJudgePassword,
  upsertJudge,
  verifyJudgeSignIn,
} from "./judges";
import { NotAllowed, PUBLIC } from "./policy";
import { MAX_FAILURES, clearFailures, isLockedOut, recordFailure, signInKey } from "./rate-limit";
import {
  createRegistration,
  listRegistrations,
  unsubscribeRegistration,
} from "./registrations";
import {
  createSubmission,
  getSubmissionForEdit,
  listSubmissionsForAdmin,
  updateSubmission,
} from "./submissions";
import { getUpload, saveUpload } from "./uploads";

beforeEach(resetDb);

const person = (email = "sam@example.org") => ({
  full_name: "Sam Example",
  email,
  country: "Canada",
});

describe("registration", () => {
  it("is refused while the switch is off or the event has moved on", async () => {
    const closed = await makeEvent({ registration_open: false });
    const judging = await makeEvent({ phase: "judging", registration_open: true });
    expect(await createRegistration(closed, "participant", person())).toEqual({ ok: false, reason: "closed" });
    expect(await createRegistration(judging, "participant", person())).toEqual({ ok: false, reason: "closed" });
    expect((await db().select().from(registrations)).length).toBe(0);
  });

  it("accepts one sign-up per email per role, ignoring capitals", async () => {
    const event = await makeEvent({ registration_open: true });
    expect((await createRegistration(event, "participant", person())).ok).toBe(true);
    expect(await createRegistration(event, "participant", person("SAM@example.org"))).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect((await createRegistration(event, "mentor", person())).ok).toBe(true);
  });

  it("keeps events separate", async () => {
    const one = await makeEvent({ registration_open: true });
    const two = await makeEvent({ registration_open: true });
    await createRegistration(one, "participant", person());
    expect((await createRegistration(two, "participant", person())).ok).toBe(true);
    expect(await listRegistrations(two, ADMIN)).toHaveLength(1);
  });

  it("can be read by admins of any role, and by nobody else", async () => {
    const event = await makeEvent({ registration_open: true });
    await createRegistration(event, "participant", person());
    const judge = await makeJudge(event);
    expect(await listRegistrations(event, VIEWER_ADMIN)).toHaveLength(1);
    await expect(listRegistrations(event, judge.viewer)).rejects.toBeInstanceOf(NotAllowed);
    await expect(listRegistrations(event, PUBLIC)).rejects.toBeInstanceOf(NotAllowed);
  });

  it("can be unsubscribed once", async () => {
    const event = await makeEvent({ registration_open: true });
    const r = await createRegistration(event, "participant", person());
    const id = r.ok ? r.id : "";
    expect(await unsubscribeRegistration(id)).toBe("done");
    expect(await unsubscribeRegistration(id)).toBe("already");
    expect(await unsubscribeRegistration("00000000-0000-4000-8000-000000000000")).toBe("invalid");
  });
});

function submission(name: string): SubmissionInput {
  return submissionSchema.parse({
    member1_name: "Ada Example",
    member1_email: "ada@example.org",
    phone: "+1 555 0100",
    country: "Canada",
    solo_or_team: "Solo",
    project_name: name,
    problem_brief: "Own problem (not one of the briefs)",
    project_category: "Web & Mobile Apps",
    customer_type: "Individuals",
    region: "North America",
    area_of_specification: "Technology",
    focus_area: "Education",
    impact_focus: "Saves time",
    solution_stage: "Prototype",
    core_problem: "Students lose their notes",
    applies_ai: "No",
    problem_statement: "Students lose track of their notes across several different apps.",
    project_description: "One place for notes that works without a connection, built in a weekend.",
    project_description_summary: "Offline notes for students",
    technologies_used: "TypeScript",
    linkedin_post_url: "https://example.org/post",
    pitch_deck_url: "https://example.org/deck.pdf",
    summary_url: "https://example.org/summary.pdf",
    disclosure_statement: "Nothing existed before the event; all of it was built this weekend.",
  });
}

describe("submissions", () => {
  it("are refused while the form is closed or the event has moved on", async () => {
    const closed = await makeEvent({ submissions_open: false });
    const judging = await makeEvent({ phase: "judging", submissions_open: true });
    expect(await createSubmission(closed, submission("Atlas"))).toEqual({ ok: false, reason: "closed" });
    expect(await createSubmission(judging, submission("Atlas"))).toEqual({ ok: false, reason: "closed" });
  });

  it("allow one project name per event, ignoring capitals", async () => {
    const event = await makeEvent({ submissions_open: true });
    const other = await makeEvent({ submissions_open: true });
    expect((await createSubmission(event, submission("Notebook"))).ok).toBe(true);
    expect(await createSubmission(event, submission("NOTEBOOK"))).toEqual({ ok: false, reason: "duplicate" });
    expect((await createSubmission(other, submission("Notebook"))).ok).toBe(true);
  });

  it("can be edited while open, without touching the organizer's flags", async () => {
    const event = await makeEvent({ submissions_open: true });
    const created = await createSubmission(event, submission("Notebook"));
    const id = created.ok ? created.id : "";
    await db()
      .update(submissions)
      .set({ hidden_from_judges: true, review_note: "check the video" })
      .where(eq(submissions.id, id));

    expect((await updateSubmission(event, id, submission("Notebook 2"))).ok).toBe(true);
    const [row] = await listSubmissionsForAdmin(event.id);
    expect(row.project_name).toBe("Notebook 2");
    expect(row.hidden_from_judges).toBe(true);
    expect(row.review_note).toBe("check the video");
    expect((await getSubmissionForEdit(event, id, ["project_name"]))?.project_name).toBe("Notebook 2");
  });

  it("can't be edited once submissions close, or from another event", async () => {
    const event = await makeEvent({ submissions_open: true });
    const other = await makeEvent({ submissions_open: true });
    const created = await createSubmission(event, submission("Notebook"));
    const id = created.ok ? created.id : "";
    expect(await updateSubmission({ ...event, submissions_open: false }, id, submission("Xenon"))).toEqual({
      ok: false,
      reason: "closed",
    });
    expect(await updateSubmission(other, id, submission("Xenon"))).toEqual({ ok: false, reason: "missing" });
    expect(await getSubmissionForEdit(other, id, ["project_name"])).toBeNull();
  });
});

describe("judge sign-in", () => {
  it("needs the right email and password, an active account, and a password set", async () => {
    const event = await makeEvent();
    await upsertJudge(event.id, { name: "Jo", email: "Jo@Example.org", role: "judge" });
    expect(await verifyJudgeSignIn(event.id, "jo@example.org", "")).toBeNull();
    expect((await checkJudgeSignIn(event.id, "jo@example.org", "x")).hasPassword).toBe(false);

    await setSharedJudgePassword(event.id, "correct horse");
    expect((await verifyJudgeSignIn(event.id, "JO@example.org", "correct horse"))?.name).toBe("Jo");
    expect(await verifyJudgeSignIn(event.id, "jo@example.org", "wrong horse")).toBeNull();
    expect(await verifyJudgeSignIn(event.id, "nobody@example.org", "correct horse")).toBeNull();

    const [row] = await db().select().from(judges);
    await deactivateJudge(event.id, row.id);
    expect(await verifyJudgeSignIn(event.id, "jo@example.org", "correct horse")).toBeNull();
    expect(await getActiveJudge(event.id, row.id)).toBeNull();
  });

  it("doesn't work across events", async () => {
    const one = await makeEvent();
    const two = await makeEvent();
    const { id } = await upsertJudge(one.id, { name: "Jo", email: "jo@example.org", role: "judge", password: "correct horse" });
    expect(await verifyJudgeSignIn(two.id, "jo@example.org", "correct horse")).toBeNull();
    expect(await getActiveJudge(two.id, id)).toBeNull();
  });

  it("gives the shared password to active judges only, and stores it hashed", async () => {
    const event = await makeEvent();
    const a = await upsertJudge(event.id, { name: "A", email: "a@example.org", role: "judge" });
    const b = await upsertJudge(event.id, { name: "B", email: "b@example.org", role: "mentor" });
    await deactivateJudge(event.id, b.id);
    expect(await setSharedJudgePassword(event.id, "correct horse")).toEqual({ updated: 1 });
    const rows = await db().select().from(judges);
    const hashA = rows.find((r) => r.id === a.id)!.password_hash!;
    expect(hashA).not.toContain("correct horse");
    expect(await verifyAdminPassword("correct horse", hashA)).toBe(true);
    expect(rows.find((r) => r.id === b.id)!.password_hash).toBeNull();
  });

  it("re-adding someone reactivates them and keeps their password", async () => {
    const event = await makeEvent();
    const { id } = await upsertJudge(event.id, { name: "Jo", email: "jo@example.org", role: "judge", password: "correct horse" });
    await deactivateJudge(event.id, id);
    const again = await upsertJudge(event.id, { name: "Jo B", email: "JO@example.org", role: "mentor" });
    expect(again.id).toBe(id);
    expect((await verifyJudgeSignIn(event.id, "jo@example.org", "correct horse"))?.role).toBe("mentor");
  });

  it("never sends password hashes to the admin panel", async () => {
    const event = await makeEvent();
    await upsertJudge(event.id, { name: "Jo", email: "jo@example.org", role: "judge", password: "correct horse" });
    const [row] = await listJudges(event.id);
    expect(JSON.stringify(row)).not.toContain("scrypt");
    expect(Object.keys(row)).not.toContain("password_hash");
  });
});

describe("admin accounts", () => {
  const input = { name: "Lee", email: "Lee@Example.org", password: "a-long-password", role: "owner" as const, createdBy: "test" };

  it("store a hash, never the password, and keep it out of the roster", async () => {
    const created = await createAdminUser(input);
    expect(created.ok).toBe(true);
    const listed = await listAdminUsers();
    expect(JSON.stringify(listed)).not.toContain("scrypt");
    expect(JSON.stringify(listed)).not.toContain("a-long-password");
    const found = await findAdminUserByEmail("lee@example.org");
    expect(found.ok && found.user && (await verifyAdminPassword("a-long-password", found.user.password_hash))).toBe(true);
  });

  it("allow one account per email, ignoring capitals", async () => {
    await createAdminUser(input);
    const again = await createAdminUser({ ...input, email: "lee@example.org" });
    expect(again.ok).toBe(false);
  });

  it("count the other active owners, so the last one can't be removed", async () => {
    const a = await createAdminUser(input);
    const b = await createAdminUser({ ...input, email: "second@example.org" });
    if (!a.ok || !b.ok) throw new Error("setup failed");
    expect(await countOtherActiveOwners(a.user.id)).toBe(1);
    expect(await countOtherActiveOwners("00000000-0000-4000-8000-000000000000")).toBe(2);
  });
});

describe("sign-in throttle", () => {
  it("locks a key out after too many failures, and only that key", async () => {
    const key = signInKey("judge", " Jo@Example.org ");
    expect(key).toBe("judge:jo@example.org");
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure(key);
    expect(await isLockedOut(key)).toBe(false);
    await recordFailure(key);
    expect(await isLockedOut(key)).toBe(true);
    expect(await isLockedOut(signInKey("judge", "other@example.org"))).toBe(false);
    expect(await isLockedOut(signInKey("admin", "jo@example.org"))).toBe(false);
    await clearFailures(key);
    expect(await isLockedOut(key)).toBe(false);
  });
});

describe("uploads", () => {
  it("store a file and give it back unchanged", async () => {
    const event = await makeEvent();
    await makeSubmission(event);
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 255, 1, 2]);
    const { id } = await saveUpload({ eventId: event.id, contentType: "image/png", bytes, createdBy: "test" });
    const back = await getUpload(id);
    expect(back?.contentType).toBe("image/png");
    expect(Buffer.from(back!.bytes).equals(bytes)).toBe(true);
    expect(await getUpload("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
