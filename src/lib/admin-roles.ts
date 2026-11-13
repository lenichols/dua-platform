// Pure role definitions — safe to import from client components.
// (Anything touching cookies/crypto/Supabase lives in src/app/admin/auth.ts
// and src/lib/admin-users.ts, which are server-only.)

export type AdminRole = "owner" | "admin" | "viewer";

/**
 * Lives here rather than in admin-password.ts so client components can show
 * the same minimum the server enforces — admin-password.ts imports node:crypto
 * and can't be pulled into the browser bundle. Re-exported from there.
 */
export const MIN_ADMIN_PASSWORD_LENGTH = 10;

export const ADMIN_ROLES: AdminRole[] = ["owner", "admin", "viewer"];

/** Viewers are read-only: they can look at everything, change nothing. */
export function canWrite(role: AdminRole): boolean {
  return role === "owner" || role === "admin";
}

/** Only owners can add/remove admin accounts or change roles. */
export function canManageTeam(role: AdminRole): boolean {
  return role === "owner";
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner:
    "Full access, including adding/removing admin accounts and changing roles.",
  admin:
    "Every operational control — phases, judges, submissions, results — but can't manage admin accounts.",
  viewer:
    "Read-only. Can watch registration counts, judging progress, and results, and export CSVs. Cannot change anything.",
};
