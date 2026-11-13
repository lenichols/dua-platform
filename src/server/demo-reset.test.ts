import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, getPool } from "@/db";
import { admin_users, events, judges, registrations, scores, submissions } from "@/db/schema";
import { createAdminUser } from "@/lib/admin-users";
import { DEMO_ADMIN, DEMO_JUDGE, demoAdminRole, isSampleEmail } from "@/lib/demo";
import { GET } from "@/app/api/demo/reset/route";
import { hasDemoData, resetDemo, seedDemo } from "../../scripts/_demo-seed.mjs";
import { makeJudge, makeSubmission, resetDb, scoreOf } from "../../test/fixtures";
import { sampleAdminLogins, sampleJudgeLogins } from "./demo";
import { getEventBySlug, type EventRow } from "./event";
import { saveScore } from "./judging";
import { createRegistration } from "./registrations";
import { saveEventSettings } from "./settings";

let event: EventRow;

beforeEach(async () => {
  await resetDb();
  // The route serves the deployment's own event, "default".
  await db().insert(events).values({ slug: "default" });
  event = (await getEventBySlug("default"))!;
});
afterEach(() => vi.unstubAllEnvs());

const counts = async () => ({
  submissions: (await db().select().from(submissions)).length,
  judges: (await db().select().from(judges)).length,
  scores: (await db().select().from(scores)).length,
  registrations: (await db().select().from(registrations)).length,
});

describe("the sample data", () => {
  it("loads five projects, two roster accounts and one score, and can be loaded twice", async () => {
    expect(await hasDemoData(getPool(), event.id)).toBe(false);
    await seedDemo(getPool(), event.id, { demoMode: true });
    await seedDemo(getPool(), event.id, { demoMode: true });
    expect(await hasDemoData(getPool(), event.id)).toBe(true);
    expect(await counts()).toEqual({ submissions: 5, judges: 2, scores: 1, registrations: 0 });
    expect((await getEventBySlug("default"))!.phase).toBe("judging");
  });

  it("gives the sample accounts the published logins only in demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    await seedDemo(getPool(), event.id, { demoMode: false });
    expect(await sampleJudgeLogins(event.id)).toEqual([]);
    expect(await sampleAdminLogins()).toEqual([]);

    await seedDemo(getPool(), event.id, { demoMode: true });
    expect((await sampleJudgeLogins(event.id)).map((l) => l.email)).toContain(DEMO_JUDGE.email);
    expect((await sampleAdminLogins())[0].can).toBe("Runs the event");
  });

  it("can make the sample admin read-only", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    await seedDemo(getPool(), event.id, { demoMode: true, adminRole: "viewer" });
    const [admin] = await db().select().from(admin_users).where(eq(admin_users.email, DEMO_ADMIN.email));
    expect(admin.role).toBe("viewer");
    expect((await sampleAdminLogins())[0].can).toMatch(/can't change anything/);
  });

  it("reads the sample admin's role from DEMO_ADMIN_ROLE, defaulting to admin", () => {
    expect(demoAdminRole()).toBe("admin");
    vi.stubEnv("DEMO_ADMIN_ROLE", "Viewer");
    expect(demoAdminRole()).toBe("viewer");
    vi.stubEnv("DEMO_ADMIN_ROLE", "owner");
    expect(demoAdminRole()).toBe("admin");
    expect(isSampleEmail(" Demo.Judge@example.org ")).toBe(true);
    expect(isSampleEmail("someone@example.org")).toBe(false);
  });
});

describe("resetting a demo site", () => {
  async function visitorsChangeThings() {
    await seedDemo(getPool(), event.id, { demoMode: true });
    const live = { ...(await getEventBySlug("default"))!, registration_open: true };
    await saveEventSettings(live, { ...live.settings, name: "Defaced Event", tracks: ["Nonsense"] });
    const extra = await makeSubmission(live);
    const judge = await makeJudge(live);
    await saveScore(live, judge.viewer, extra, scoreOf(1));
    await createRegistration(live, "participant", { full_name: "Visitor", email: "visitor@example.org" });
    await db().update(events).set({ phase: "results", registration_open: true }).where(eq(events.id, event.id));
  }

  it("puts back the sample data, the default settings and the judging phase", async () => {
    await visitorsChangeThings();
    expect((await getEventBySlug("default"))!.settings.name).toBe("Defaced Event");

    await resetDemo(getPool(), event.id);
    const after = (await getEventBySlug("default"))!;
    expect(after.settings.name).toBe("Open Build Hackathon");
    expect(after.phase).toBe("judging");
    expect(after.registration_open).toBe(false);
    expect(await counts()).toEqual({ submissions: 5, judges: 2, scores: 1, registrations: 0 });
  });

  it("leaves the owner's own admin accounts alone", async () => {
    await createAdminUser({ name: "Owner", email: "owner@example.org", password: "a-long-password", role: "owner", createdBy: "test" });
    await visitorsChangeThings();
    await resetDemo(getPool(), event.id, { adminRole: "viewer" });
    const admins = await db().select().from(admin_users);
    expect(admins.map((a) => [a.email, a.role]).sort()).toEqual([
      [DEMO_ADMIN.email, "viewer"],
      ["owner@example.org", "owner"],
    ]);
  });

  it("leaves another event's data alone", async () => {
    const [other] = await db().insert(events).values({ slug: "other" }).returning();
    const otherEvent = (await getEventBySlug("other"))!;
    await makeSubmission(otherEvent);
    await resetDemo(getPool(), event.id);
    const kept = await db().select().from(submissions).where(eq(submissions.event_id, other.id));
    expect(kept).toHaveLength(1);
  });
});

describe("the reset endpoint", () => {
  const call = (auth?: string) =>
    GET(new Request("http://localhost/api/demo/reset", { headers: auth ? { authorization: auth } : {} }));

  it("doesn't exist outside demo mode, even with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const extra = await makeSubmission(event);
    expect((await call("Bearer s3cret")).status).toBe(404);
    expect((await db().select().from(submissions)).map((s) => s.id)).toEqual([extra]);
  });

  it("refuses to run without a secret configured, or with the wrong one", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    expect((await call("Bearer anything")).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret");
    for (const auth of [undefined, "Bearer wrong", "s3cret", "Bearer s3cret-and-more", "Basic s3cret"]) {
      expect((await call(auth)).status).toBe(401);
    }
    expect(await hasDemoData(getPool(), event.id)).toBe(false);
  });

  it("resets the demo when called with the secret", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("DEMO_ADMIN_ROLE", "viewer");
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, submissions: 5 });
    expect(await hasDemoData(getPool(), event.id)).toBe(true);
    const [admin] = await db().select().from(admin_users);
    expect(admin.role).toBe("viewer");
  });
});
