import { cookies } from "next/headers";
import { cache } from "react";
import { createHmac, timingSafeEqual } from "crypto";
import { getCurrentEvent } from "@/server/event";
import { getActiveJudge, type JudgeSession } from "@/server/judges";

const COOKIE = "dua_judge";
const MAX_AGE_SECONDS = 60 * 60 * 24; // 24h

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
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearJudgeCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

/**
 * The signed-in judge or mentor, or null. The roster is read on every
 * request, so deactivating someone signs them out immediately.
 */
export const getJudgeSession = cache(async (): Promise<JudgeSession | null> => {
  const store = await cookies();
  const tok = store.get(COOKIE)?.value;
  if (!tok) return null;
  const payload = verifyToken(tok);
  if (!payload?.startsWith("judge:")) return null;
  const [, judgeId, issuedAt] = payload.split(":");
  if (!judgeId) return null;
  // The browser drops the cookie after maxAge; this stops a copied one too.
  const iat = Number.parseInt(issuedAt ?? "", 10);
  if (!Number.isFinite(iat) || Date.now() - iat > MAX_AGE_SECONDS * 1000) return null;

  const event = await getCurrentEvent();
  return getActiveJudge(event.id, judgeId);
});
