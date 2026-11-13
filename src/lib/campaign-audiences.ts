// Audience names and campaign types. No database imports, so client
// components can use this file.

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

export function parseAudience(raw: unknown): Audience | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return (AUDIENCES as string[]).includes(v) ? (v as Audience) : null;
}
