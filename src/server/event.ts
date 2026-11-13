import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { events } from "@/db/schema";

export type Phase = "submissions" | "judging" | "results";
export const PHASES: Phase[] = ["submissions", "judging", "results"];

export type EventRow = {
  id: string;
  slug: string;
  phase: Phase;
  submissions_open: boolean;
  registration_open: boolean;
  closed_at: Date | null;
  updated_at: Date;
};

/** Which event this deployment serves. One per deployment for now. */
export function currentEventSlug(): string {
  return process.env.DUA_EVENT_SLUG?.trim() || "default";
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const [row] = await db().select().from(events).where(eq(events.slug, slug)).limit(1);
  return row ? ({ ...row, phase: row.phase as Phase } satisfies EventRow) : null;
}

/**
 * The event this deployment serves. Read once per request.
 * Throws if the database hasn't been set up, with the command that fixes it.
 */
export const getCurrentEvent = cache(async (): Promise<EventRow> => {
  const slug = currentEventSlug();
  const event = await getEventBySlug(slug);
  if (!event)
    throw new Error(`No event "${slug}" in the database. Run: npm run db:migrate`);
  return event;
});

export async function setEventPhase(eventId: string, phase: Phase): Promise<EventRow | null> {
  const [row] = await db()
    .update(events)
    .set({ phase, closed_at: phase === "results" ? new Date() : null })
    .where(eq(events.id, eventId))
    .returning();
  return row ? { ...row, phase: row.phase as Phase } : null;
}

export async function setSubmissionsOpen(eventId: string, open: boolean): Promise<void> {
  await db().update(events).set({ submissions_open: open }).where(eq(events.id, eventId));
}

export async function setRegistrationOpen(eventId: string, open: boolean): Promise<void> {
  await db().update(events).set({ registration_open: open }).where(eq(events.id, eventId));
}
