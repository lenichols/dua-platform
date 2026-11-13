import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db, isUniqueViolation } from "@/db";
import { admin_users } from "@/db/schema";
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

type Row = typeof admin_users.$inferSelect;

// The hash is left out unless a caller asks for it by name.
function toAdminUser(r: Row): AdminUser {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role as AdminRole,
    is_active: r.is_active,
    is_protected: r.is_protected,
    created_by: r.created_by,
    last_login_at: r.last_login_at?.toISOString() ?? null,
    created_at: r.created_at.toISOString(),
  };
}

const withHash = (r: Row): AdminUserWithHash => ({
  ...toAdminUser(r),
  password_hash: r.password_hash,
});

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type AdminUsersResult =
  | { ok: true; users: AdminUser[] }
  | { ok: false; error: string };

export async function listAdminUsers(): Promise<AdminUsersResult> {
  try {
    const rows = await db()
      .select()
      .from(admin_users)
      .orderBy(asc(admin_users.role), asc(admin_users.name));
    return { ok: true, users: rows.map(toAdminUser) };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function findAdminUserByEmail(
  email: string,
): Promise<{ ok: true; user: AdminUserWithHash | null } | { ok: false; error: string }> {
  try {
    const [row] = await db()
      .select()
      .from(admin_users)
      .where(sql`lower(${admin_users.email}) = ${email.trim().toLowerCase()}`)
      .limit(1);
    return { ok: true, user: row ? withHash(row) : null };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

/** Includes the hash — for verifying someone's current password. */
export async function findAdminUserById(id: string): Promise<AdminUserWithHash | null> {
  const [row] = await db().select().from(admin_users).where(eq(admin_users.id, id)).limit(1);
  return row ? withHash(row) : null;
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const [row] = await db().select().from(admin_users).where(eq(admin_users.id, id)).limit(1);
  return row ? toAdminUser(row) : null;
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  createdBy: string;
}): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  const password_hash = await hashAdminPassword(input.password);
  try {
    const [row] = await db()
      .insert(admin_users)
      .values({
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password_hash,
        role: input.role,
        is_active: true,
        created_by: input.createdBy,
      })
      .returning();
    return { ok: true, user: toAdminUser(row) };
  } catch (e) {
    if (isUniqueViolation(e))
      return { ok: false, error: "An admin account with that email already exists." };
    return { ok: false, error: message(e) };
  }
}

type Outcome = { ok: true } | { ok: false; error: string };

export async function setAdminUserPassword(id: string, password: string): Promise<Outcome> {
  try {
    const password_hash = await hashAdminPassword(password);
    await db().update(admin_users).set({ password_hash }).where(eq(admin_users.id, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function updateAdminUser(
  id: string,
  patch: { role?: AdminRole; is_active?: boolean; is_protected?: boolean },
): Promise<Outcome> {
  try {
    await db().update(admin_users).set(patch).where(eq(admin_users.id, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function deleteAdminUser(id: string): Promise<Outcome> {
  try {
    await db().delete(admin_users).where(eq(admin_users.id, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function touchAdminLastLogin(id: string): Promise<void> {
  await db().update(admin_users).set({ last_login_at: new Date() }).where(eq(admin_users.id, id));
}

async function countOthers(excludeId: string, extra: ReturnType<typeof eq>): Promise<number> {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(admin_users)
    .where(and(extra, eq(admin_users.is_active, true), ne(admin_users.id, excludeId)));
  return Number(row?.n ?? 0);
}

/**
 * There must always be at least one active super admin. They're the only
 * accounts that can change or remove anyone, so hitting zero would freeze the
 * roster permanently — recoverable only via the shared password or SQL.
 */
export function countOtherActiveSuperAdmins(excludeId: string): Promise<number> {
  return countOthers(excludeId, eq(admin_users.is_protected, true));
}

/**
 * Guard against locking everyone out: there must always be at least one
 * ACTIVE owner left after a demote / deactivate / delete.
 */
export function countOtherActiveOwners(excludeId: string): Promise<number> {
  return countOthers(excludeId, eq(admin_users.role, "owner"));
}
