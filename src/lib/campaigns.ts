import { createAdminClient } from "@/lib/supabase/admin";

export type Audience =
  | "all"
  | "participant"
  | "mentor"
  | "admins"
  | "super_admins";

/**
 * Admin audiences read from admin_users, not registrations. They're internal
 * operational mail, so they carry no unsubscribe link — there's no
 * registration row to stamp, and staff can't opt out of it.
 */
export function isAdminAudience(a: Audience): boolean {
  return a === "admins" || a === "super_admins";
}

export const AUDIENCES: Audience[] = [
  "all",
  "participant",
  "mentor",
  "admins",
  "super_admins",
];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "Everyone (all registrants)",
  participant: "Innovators only",
  mentor: "Coaches only",
  admins: "Admin team (internal)",
  super_admins: "Super admins only (internal)",
};

export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export type Campaign = {
  id: string;
  subject: string;
  body_html: string;
  audience: Audience;
  status: CampaignStatus;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  error_detail: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
};

/** `id` is null for admin recipients — they have no registration to unsubscribe. */
export type Recipient = {
  id: string | null;
  full_name: string;
  email: string;
};

export const MISSING_CAMPAIGNS_TABLE =
  "The email_campaigns table doesn't exist yet. Run supabase/migrations/0014_email_campaigns.sql in the Supabase SQL Editor, then try again.";

export function isMissingCampaignsTable(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /email_campaigns.*(does not exist|could not find|not found)/i.test(
    error.message ?? "",
  );
}

export function parseAudience(raw: unknown): Audience | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return (AUDIENCES as string[]).includes(v) ? (v as Audience) : null;
}

/**
 * Everyone in the audience who hasn't opted out. Deduplicated by email —
 * registrations are unique on (email, role), so someone signed up as both an
 * innovator and a coach would otherwise get the "Everyone" blast twice.
 */
export async function loadRecipients(
  audience: Audience,
): Promise<{ ok: true; recipients: Recipient[] } | { ok: false; error: string }> {
  const admin = createAdminClient();

  if (isAdminAudience(audience)) {
    let q = admin
      .from("admin_users")
      .select("name, email")
      .eq("is_active", true)
      .order("name");
    if (audience === "super_admins") q = q.eq("is_protected", true);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };

    const seen = new Set<string>();
    const out: Recipient[] = [];
    for (const a of data ?? []) {
      const email = String(a.email ?? "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push({ id: null, full_name: a.name, email });
    }
    return { ok: true, recipients: out };
  }

  let query = admin
    .from("registrations")
    .select("id, full_name, email")
    .is("unsubscribed_at", null)
    .order("created_at");

  if (audience !== "all") query = query.eq("role", audience);

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const r of data ?? []) {
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ id: r.id, full_name: r.full_name, email });
  }
  return { ok: true, recipients };
}

export async function countAudience(
  audience: Audience,
): Promise<{ subscribed: number; unsubscribed: number }> {
  const admin = createAdminClient();

  if (isAdminAudience(audience)) {
    let q = admin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (audience === "super_admins") q = q.eq("is_protected", true);
    const { count } = await q;
    // Staff can't opt out of internal mail, so there's nothing to skip.
    return { subscribed: count ?? 0, unsubscribed: 0 };
  }

  const base = () => {
    let q = admin.from("registrations").select("id", { count: "exact", head: true });
    if (audience !== "all") q = q.eq("role", audience);
    return q;
  };
  const [{ count: subscribed }, { count: unsubscribed }] = await Promise.all([
    base().is("unsubscribed_at", null),
    base().not("unsubscribed_at", "is", null),
  ]);
  return { subscribed: subscribed ?? 0, unsubscribed: unsubscribed ?? 0 };
}

export async function listCampaigns(
  limit = 25,
): Promise<{ ok: true; campaigns: Campaign[] } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return {
      ok: false,
      error: isMissingCampaignsTable(error) ? MISSING_CAMPAIGNS_TABLE : error.message,
    };
  }
  return { ok: true, campaigns: (data ?? []) as Campaign[] };
}

export async function createCampaign(input: {
  subject: string;
  bodyHtml: string;
  audience: Audience;
  recipientCount: number;
  createdBy: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_campaigns")
    .insert({
      subject: input.subject,
      body_html: input.bodyHtml,
      audience: input.audience,
      status: "sending",
      recipient_count: input.recipientCount,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error: isMissingCampaignsTable(error) ? MISSING_CAMPAIGNS_TABLE : error.message,
    };
  }
  return { ok: true, id: data.id as string };
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
  const admin = createAdminClient();
  await admin
    .from("email_campaigns")
    .update({ ...patch, sent_at: new Date().toISOString() })
    .eq("id", id);
}
