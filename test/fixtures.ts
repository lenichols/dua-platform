// Helpers for tests that need rows in the database.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { events, judges, submissions } from "@/db/schema";
import { DEFAULT_RUBRIC, resolveSettings, type EventSettings } from "@/lib/event-settings";
import type { EventRow, Phase } from "@/server/event";
import type { Viewer } from "@/server/policy";

/** Empty every table. Call in beforeEach. */
export async function resetDb(): Promise<void> {
  await db().execute(sql`
    truncate table events, admin_users, sign_in_failures restart identity cascade
  `);
}

let counter = 0;
const next = () => ++counter;

export async function makeEvent(
  over: Partial<Pick<EventRow, "phase" | "submissions_open" | "registration_open">> & {
    settings?: Partial<EventSettings>;
  } = {},
): Promise<EventRow> {
  const { settings, ...columns } = over;
  const [row] = await db()
    .insert(events)
    .values({ slug: `event-${next()}`, ...columns, settings: settings ?? {} })
    .returning();
  return { ...row, phase: row.phase as Phase, settings: resolveSettings(row.settings) };
}

/** The same event as the database has it now, e.g. after changing its phase. */
export function inPhase(event: EventRow, phase: Phase): EventRow {
  return { ...event, phase };
}

export async function makeSubmission(
  event: EventRow,
  over: Partial<typeof submissions.$inferInsert> = {},
): Promise<string> {
  const n = next();
  const [row] = await db()
    .insert(submissions)
    .values({
      event_id: event.id,
      project_name: `Project ${n}`,
      team_name: `Team ${n}`,
      member1_name: "Ada Example",
      member1_email: `ada${n}@example.org`,
      phone: "+1 555 0100",
      city: "Springfield",
      state_region: "Example State",
      submitter_linkedin_url: "https://example.org/in/ada",
      member2_name: "Grace Example",
      member2_email: `grace${n}@example.org`,
      member2_linkedin_url: "https://example.org/in/grace",
      member2_occupation: "Engineer",
      ...over,
    })
    .returning({ id: submissions.id });
  return row.id;
}

export async function makeJudge(
  event: EventRow,
  role: "judge" | "mentor" = "judge",
  over: Partial<typeof judges.$inferInsert> = {},
): Promise<{ id: string; viewer: Viewer & { kind: "judge" } }> {
  const n = next();
  const [row] = await db()
    .insert(judges)
    .values({ event_id: event.id, name: `Judge ${n}`, email: `judge${n}@example.org`, role, ...over })
    .returning({ id: judges.id });
  return { id: row.id, viewer: { kind: "judge", judgeId: row.id, role } };
}

export const ADMIN: Viewer = { kind: "admin", role: "admin" };
export const VIEWER_ADMIN: Viewer = { kind: "admin", role: "viewer" };

/** A complete, valid score on the default rubric: the same mark on every criterion. */
export function scoreOf(mark: number, rubric = DEFAULT_RUBRIC) {
  const marks: Record<string, number> = {};
  const evidence: Record<string, string> = {};
  for (const c of rubric.criteria) {
    marks[c.key] = mark;
    evidence[c.key] = `Evidence for ${c.label}: the demo showed this working.`;
  }
  return { marks, evidence };
}
