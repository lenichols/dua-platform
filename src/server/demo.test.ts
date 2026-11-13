import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminUser } from "@/lib/admin-users";
import { DEMO_ADMIN, DEMO_JUDGE, DEMO_MENTOR } from "@/lib/demo";
import { makeEvent, resetDb } from "../../test/fixtures";
import { sampleAdminLogins, sampleJudgeLogins } from "./demo";
import { deactivateJudge, upsertJudge } from "./judges";

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());

async function seedSamples() {
  const event = await makeEvent();
  const judge = await upsertJudge(event.id, {
    name: "J",
    email: DEMO_JUDGE.email,
    role: "judge",
    password: DEMO_JUDGE.password,
  });
  await upsertJudge(event.id, {
    name: "M",
    email: DEMO_MENTOR.email,
    role: "mentor",
    password: DEMO_MENTOR.password,
  });
  await createAdminUser({
    name: "A",
    email: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
    role: "admin",
    createdBy: "test",
  });
  return { event, judgeId: judge.id };
}

describe("sample logins on the sign-in pages", () => {
  it("are never offered outside demo mode, even when the accounts exist", async () => {
    const { event } = await seedSamples();
    for (const value of ["", "false", "1", "yes"]) {
      vi.stubEnv("DEMO_MODE", value);
      expect(await sampleJudgeLogins(event.id)).toEqual([]);
      expect(await sampleAdminLogins()).toEqual([]);
    }
  });

  it("are offered in demo mode for the sample accounts that exist", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const empty = await makeEvent();
    expect(await sampleJudgeLogins(empty.id)).toEqual([]);
    expect(await sampleAdminLogins()).toEqual([]);

    const { event } = await seedSamples();
    expect((await sampleJudgeLogins(event.id)).map((l) => l.label)).toEqual(["Judge", "Mentor"]);
    expect((await sampleAdminLogins()).map((l) => l.email)).toEqual([DEMO_ADMIN.email]);
  });

  it("drop a login that would no longer work", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const { event, judgeId } = await seedSamples();
    await deactivateJudge(event.id, judgeId);
    await upsertJudge(event.id, {
      name: "M",
      email: DEMO_MENTOR.email,
      role: "mentor",
      password: "changed by the organizer",
    });
    expect(await sampleJudgeLogins(event.id)).toEqual([]);
  });
});
