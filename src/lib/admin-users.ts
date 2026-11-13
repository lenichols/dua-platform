import { createAdminClient } from "@/lib/supabase/admin";
import { hashAdminPassword } from "@/lib/admin-password";
import type { AdminRole } from "@/lib/admin-roles";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  is_protected: boolean;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
};

export type AdminUserWithHash = AdminUser & { password_hash: string };

const COLUMNS =
  "id, name, email, role, is_active, is_protected, created_by, last_login_at, created_at";

export const MISSING_TABLE_HINT =
  "The admin_users table doesn't exist yet. Run supabase/migrations/0012_admin_users.sql in the Supabase SQL Editor, then try again.";

/** PostgREST reports a missing table as 42P01 (or PGRST205 via the schema cache). */
export function isMissingAdminUsersTable(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /admin_users.*(does not exist|could not find|not found)/i.test(
    error.message ?? "",
  );
}

export type AdminUsersResult =
  | { ok: true; users: AdminUser[] }
  | { ok: false; error: string; missingTable: boolean };

export async function listAdminUsers(): Promise<AdminUsersResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select(COLUMNS)
    .order("role")
    .order("name");
  if (error) {
    return {
      ok: false,
      error: isMissingAdminUsersTable(error) ? MISSING_TABLE_HINT : error.message,
      missingTable: isMissingAdminUsersTable(error),
    };
  }
  return { ok: true, users: (data ?? []) as AdminUser[] };
}

export async function findAdminUserByEmail(
  email: string,
): Promise<
  | { ok: true; user: AdminUserWithHash | null }
  | { ok: false; error: string; missingTable: boolean }
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select(`${COLUMNS}, password_hash`)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      error: isMissingAdminUsersTable(error) ? MISSING_TABLE_HINT : error.message,
      missingTable: isMissingAdminUsersTable(error),
    };
  }
  return { ok: true, user: (data as AdminUserWithHash | null) ?? null };
}

/** Includes the hash — for verifying someone's current password. */
export async function findAdminUserById(
  id: string,
): Promise<AdminUserWithHash | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_users")
    .select(`${COLUMNS}, password_hash`)
    .eq("id", id)
    .maybeSingle();
  return (data as AdminUserWithHash | null) ?? null;
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_users")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as AdminUser | null) ?? null;
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  createdBy: string;
}): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const password_hash = await hashAdminPassword(input.password);
  const { data, error } = await admin
    .from("admin_users")
    .insert({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password_hash,
      role: input.role,
      is_active: true,
      created_by: input.createdBy,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    if (isMissingAdminUsersTable(error)) return { ok: false, error: MISSING_TABLE_HINT };
    if (error.code === "23505")
      return { ok: false, error: "An admin account with that email already exists." };
    return { ok: false, error: error.message };
  }
  return { ok: true, user: data as AdminUser };
}

export async function setAdminUserPassword(
  id: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const password_hash = await hashAdminPassword(password);
  const { error } = await admin
    .from("admin_users")
    .update({ password_hash })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateAdminUser(
  id: string,
  patch: { role?: AdminRole; is_active?: boolean; is_protected?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_users").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteAdminUser(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_users").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function touchAdminLastLogin(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * There must always be at least one active super admin. They're the only
 * accounts that can change or remove anyone, so hitting zero would freeze the
 * roster permanently — recoverable only via the shared password or SQL.
 */
export async function countOtherActiveSuperAdmins(
  excludeId: string,
): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("admin_users")
    .select("id", { count: "exact", head: true })
    .eq("is_protected", true)
    .eq("is_active", true)
    .neq("id", excludeId);
  return count ?? 0;
}

/**
 * Guard against locking everyone out: there must always be at least one
 * ACTIVE owner left after a demote / deactivate / delete.
 */
export async function countOtherActiveOwners(excludeId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("admin_users")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner")
    .eq("is_active", true)
    .neq("id", excludeId);
  return count ?? 0;
}
