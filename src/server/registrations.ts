// Participant and mentor sign-ups. Personal details: written by the public
// forms, read only by admins.

import { and, desc, eq } from "drizzle-orm";
import { db, isUniqueViolation } from "@/db";
import { registrations } from "@/db/schema";
import type { EventRow } from "./event";
import { plainAll } from "./plain";
import {
  NotAllowed,
  canSeeRegistrations,
  mentorSignupAccepting,
  registrationAccepting,
  type Viewer,
} from "./policy";

export type RegistrationRole = "participant" | "mentor";

type NewRegistration = Omit<
  typeof registrations.$inferInsert,
  "id" | "event_id" | "role" | "created_at" | "unsubscribed_at"
>;

export type RegisterOutcome =
  | { ok: true; id: string }
  | { ok: false; reason: "closed" | "duplicate" };

/** Add a sign-up. Refused while sign-ups are closed, or the event doesn't take them. */
export async function createRegistration(
  event: EventRow,
  role: RegistrationRole,
  data: NewRegistration,
): Promise<RegisterOutcome> {
  const accepting = role === "mentor" ? mentorSignupAccepting(event) : registrationAccepting(event);
  if (!accepting) return { ok: false, reason: "closed" };
  try {
    const [row] = await db()
      .insert(registrations)
      // A question that wasn't asked arrives blank; "Solo or team" only
      // accepts its two answers or nothing.
      .values({
        ...data,
        participating_as: data.participating_as || null,
        event_id: event.id,
        role,
      })
      .returning({ id: registrations.id });
    return { ok: true, id: row.id };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "duplicate" };
    throw e;
  }
}

/** Every sign-up, newest first. Admins only. */
export async function listRegistrations(event: EventRow, viewer: Viewer) {
  if (!canSeeRegistrations(viewer)) throw new NotAllowed();
  const rows = await db()
    .select()
    .from(registrations)
    .where(eq(registrations.event_id, event.id))
    .orderBy(desc(registrations.created_at));
  return plainAll(rows);
}

export async function deleteRegistration(eventId: string, id: string): Promise<void> {
  await db()
    .delete(registrations)
    .where(and(eq(registrations.event_id, eventId), eq(registrations.id, id)));
}

export type UnsubscribeOutcome = "done" | "already" | "invalid";

/** Stop campaign email to one registrant. The caller has verified the signed link. */
export async function unsubscribeRegistration(id: string): Promise<UnsubscribeOutcome> {
  const [row] = await db()
    .select({ id: registrations.id, unsubscribed_at: registrations.unsubscribed_at })
    .from(registrations)
    .where(eq(registrations.id, id))
    .limit(1);
  if (!row) return "invalid";
  if (row.unsubscribed_at) return "already";
  await db()
    .update(registrations)
    .set({ unsubscribed_at: new Date() })
    .where(eq(registrations.id, id));
  return "done";
}
