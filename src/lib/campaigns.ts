import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { admin_users, email_campaigns, registrations } from "@/db/schema";

import {
  isAdminAudience,
  type Audience,
  type Campaign,
  type CampaignStatus,
  type Recipient,
} from "./campaign-audiences";

export * from "./campaign-audiences";

/**
 * Everyone in the audience who hasn't opted out. Deduplicated by email —
 * registrations are unique on (email, role), so someone signed up as both an
 * innovator and a coach would otherwise get the "Everyone" blast twice.
 */
export async function loadRecipients(
  eventId: string,
  audience: Audience,
): Promise<{ ok: true; recipients: Recipient[] } | { ok: false; error: string }> {
  try {
    const rows: Recipient[] = isAdminAudience(audience)
      ? (
          await db()
            .select({ name: admin_users.name, email: admin_users.email })
            .from(admin_users)
            .where(
              and(
                eq(admin_users.is_active, true),
                audience === "super_admins" ? eq(admin_users.is_protected, true) : undefined,
              ),
            )
            .orderBy(asc(admin_users.name))
        ).map((a) => ({ id: null, full_name: a.name, email: a.email }))
      : await db()
          .select({
            id: registrations.id,
            full_name: registrations.full_name,
            email: registrations.email,
          })
          .from(registrations)
          .where(
            and(
              eq(registrations.event_id, eventId),
              isNull(registrations.unsubscribed_at),
              audience === "all" ? undefined : eq(registrations.role, audience),
            ),
          )
          .orderBy(asc(registrations.created_at));

    const seen = new Set<string>();
    const recipients: Recipient[] = [];
    for (const r of rows) {
      const email = String(r.email ?? "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      recipients.push({ ...r, email });
    }
    return { ok: true, recipients };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function countAudience(
  eventId: string,
  audience: Audience,
): Promise<{ subscribed: number; unsubscribed: number }> {
  const count = sql<number>`count(*)::int`;

  if (isAdminAudience(audience)) {
    const [row] = await db()
      .select({ n: count })
      .from(admin_users)
      .where(
        and(
          eq(admin_users.is_active, true),
          audience === "super_admins" ? eq(admin_users.is_protected, true) : undefined,
        ),
      );
    // Staff can't opt out of internal mail, so there's nothing to skip.
    return { subscribed: Number(row?.n ?? 0), unsubscribed: 0 };
  }

  const inAudience = and(
    eq(registrations.event_id, eventId),
    audience === "all" ? undefined : eq(registrations.role, audience),
  );
  const [[subscribed], [unsubscribed]] = await Promise.all([
    db()
      .select({ n: count })
      .from(registrations)
      .where(and(inAudience, isNull(registrations.unsubscribed_at))),
    db()
      .select({ n: count })
      .from(registrations)
      .where(and(inAudience, isNotNull(registrations.unsubscribed_at))),
  ]);
  return {
    subscribed: Number(subscribed?.n ?? 0),
    unsubscribed: Number(unsubscribed?.n ?? 0),
  };
}

export async function listCampaigns(
  eventId: string,
  limit = 25,
): Promise<{ ok: true; campaigns: Campaign[] } | { ok: false; error: string }> {
  try {
    const rows = await db()
      .select()
      .from(email_campaigns)
      .where(eq(email_campaigns.event_id, eventId))
      .orderBy(desc(email_campaigns.created_at))
      .limit(limit);
    return {
      ok: true,
      campaigns: rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        body_html: r.body_html,
        audience: r.audience as Audience,
        status: r.status as CampaignStatus,
        recipient_count: r.recipient_count,
        sent_count: r.sent_count,
        failed_count: r.failed_count,
        error_detail: r.error_detail,
        sent_at: r.sent_at?.toISOString() ?? null,
        created_by: r.created_by,
        created_at: r.created_at.toISOString(),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createCampaign(input: {
  eventId: string;
  subject: string;
  bodyHtml: string;
  audience: Audience;
  recipientCount: number;
  createdBy: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const [row] = await db()
      .insert(email_campaigns)
      .values({
        event_id: input.eventId,
        subject: input.subject,
        body_html: input.bodyHtml,
        audience: input.audience,
        status: "sending",
        recipient_count: input.recipientCount,
        created_by: input.createdBy,
      })
      .returning({ id: email_campaigns.id });
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function finalizeCampaign(
  id: string,
  patch: {
    status: CampaignStatus;
    sent_count: number;
    failed_count: number;
    error_detail?: string | null;
  },
): Promise<void> {
  await db()
    .update(email_campaigns)
    .set({ ...patch, sent_at: new Date() })
    .where(eq(email_campaigns.id, id));
}
