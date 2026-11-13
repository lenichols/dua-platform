import { cookies } from "next/headers";
import { cache } from "react";
import { createHmac, timingSafeEqual } from "crypto";
import { getAdminUserById, type AdminUser } from "@/lib/admin-users";
import { canManageTeam, canWrite, type AdminRole } from "@/lib/admin-roles";

const COOKIE = "dua_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h

export type { AdminRole };

export type AdminSession = {
  /** admin_users.id, or "shared" for the env-password break-glass login. */
  id: string;
  name: string;
  email: string | null;
  role: AdminRole;
  /** True when signed in with the shared ADMIN_PASSWORD rather than an account. */
  viaSharedPassword: boolean;
  /**
   * Super administrator. Protected accounts can only be changed or removed by
   * another protected account, and only they can change/remove anyone.
   */
  isProtected: boolean;
};

// ── cookie signing ───────────────────────────────────────────────
function secret() {
  const s = process.env.SUBMISSION_EDIT_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD or SUBMISSION_EDIT_SECRET env var required");
  return s;
}

function signToken(payload: string) {
  const mac = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return payload;
}

type CookiePayload =
  | { v: 1; kind: "user"; id: string; iat: number }
  | { v: 1; kind: "shared"; iat: number };

function encode(payload: CookiePayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decode(raw: string): CookiePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (parsed?.v !== 1) return null;
    if (parsed.kind === "user" && typeof parsed.id === "string") return parsed;
    if (parsed.kind === "shared") return parsed;
    return null;
  } catch {
    return null;
  }
}

async function setCookie(payload: CookiePayload) {
  const store = await cookies();
  store.set(COOKIE, signToken(encode(payload)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Signs in a specific admin_users row. */
export async function issueAdminCookieForUser(userId: string) {
  await setCookie({ v: 1, kind: "user", id: userId, iat: Date.now() });
}

/** Signs in via the shared ADMIN_PASSWORD (owner-level break-glass). */
export async function issueAdminCookie() {
  await setCookie({ v: 1, kind: "shared", iat: Date.now() });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export const SHARED_SESSION: AdminSession = {
  id: "shared",
  name: "Shared password",
  email: null,
  role: "owner",
  viaSharedPassword: true,
  // The break-glass path counts as a super admin: it's the recovery route if
  // every founder loses access, and whoever holds the Vercel env already
  // controls the database outright.
  isProtected: true,
};

/**
 * Resolves the signed-in admin. Roles are read from the DB on every request
 * (not baked into the cookie), so demoting or deactivating someone takes
 * effect immediately instead of at their next sign-in.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const store = await cookies();
  const tok = store.get(COOKIE)?.value;
  if (!tok) return null;

  const payload = verifyToken(tok);
  if (!payload) return null;

  // Cookies issued before multi-admin support: `admin:<timestamp>`.
  if (payload.startsWith("admin:")) {
    const iat = Number.parseInt(payload.slice("admin:".length), 10);
    if (Number.isFinite(iat) && Date.now() - iat > MAX_AGE_SECONDS * 1000)
      return null;
    return SHARED_SESSION;
  }

  const parsed = decode(payload);
  if (!parsed) return null;
  if (Date.now() - parsed.iat > MAX_AGE_SECONDS * 1000) return null;

  if (parsed.kind === "shared") return SHARED_SESSION;

  const user = await getAdminUserById(parsed.id);
  if (!user || !user.is_active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    viaSharedPassword: false,
    isProtected: user.is_protected ?? false,
  };
});

export async function isAdminSignedIn(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

// ── guards for server actions ────────────────────────────────────
type Guard =
  | { ok: true; session: AdminSession }
  | { ok: false; error: string };

export async function requireAdmin(): Promise<Guard> {
  const session = await getAdminSession();
  if (!session)
    return { ok: false, error: "Admin session expired — please sign in again." };
  return { ok: true, session };
}

/** Any action that changes data must go through this. */
export async function requireWriteAccess(): Promise<Guard> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!canWrite(guard.session.role))
    return {
      ok: false,
      error: "Your account is read-only. Ask an owner if you need to make changes.",
    };
  return guard;
}

export async function requireTeamAccess(): Promise<Guard> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!canManageTeam(guard.session.role))
    return { ok: false, error: "Only owners can manage admin accounts." };
  return guard;
}

/**
 * Changing or removing ANY admin account — delete, deactivate, role change,
 * password reset, protection toggle — is super-admin-only. Ordinary owners can
 * grow the team but can't remove or re-rank the people already on it, so a
 * newly elected admin can never lock out the founders or each other.
 */
export async function requireSuperAdmin(): Promise<Guard> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!guard.session.isProtected)
    return {
      ok: false,
      error:
        "Only super administrators can change or remove admin accounts. You can add new ones.",
    };
  return guard;
}

/** Label recorded on rows this session creates. */
export function sessionLabel(session: AdminSession): string {
  return session.viaSharedPassword
    ? "shared password"
    : `${session.name} <${session.email}>`;
}

// ── password check for the shared env password ───────────────────
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type { AdminUser };
