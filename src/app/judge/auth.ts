import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE = "dua_judge";

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

export async function issueJudgeCookie(judgeId: string) {
  const token = signToken(`judge:${judgeId}:${Date.now()}`);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
}

export async function clearJudgeCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export type CustomJudgeSession = {
  id: string;
  name: string;
  is_active: boolean;
  role: "judge" | "mentor";
};

export async function getCustomJudge(): Promise<CustomJudgeSession | null> {
  const store = await cookies();
  const tok = store.get(COOKIE)?.value;
  if (!tok) return null;
  const payload = verifyToken(tok);
  if (!payload?.startsWith("judge:")) return null;
  const judgeId = payload.split(":")[1];
  if (!judgeId) return null;

  const admin = createAdminClient();
  // Try with role; fall back if column missing
  const withRole = await admin
    .from("judges")
    .select("id, name, is_active, role")
    .eq("id", judgeId)
    .maybeSingle();
  if (!withRole.error && withRole.data) {
    if (!withRole.data.is_active) return null;
    return {
      id: withRole.data.id,
      name: withRole.data.name,
      is_active: withRole.data.is_active,
      role: (withRole.data.role as "judge" | "mentor") ?? "judge",
    };
  }
  const fallback = await admin
    .from("judges")
    .select("id, name, is_active")
    .eq("id", judgeId)
    .maybeSingle();
  if (!fallback.data?.is_active) return null;
  return {
    id: fallback.data.id,
    name: fallback.data.name,
    is_active: fallback.data.is_active,
    role: "judge",
  };
}

/** Constant-time string compare. */
export function passwordsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
