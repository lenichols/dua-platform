import { timingSafeEqual } from "crypto";
import { getPool } from "@/db";
import { demoAdminRole, demoMode } from "@/lib/demo";
import { getCurrentEvent } from "@/server/event";
import { resetDemo } from "../../../../../scripts/_demo-seed.mjs";

export const dynamic = "force-dynamic";

/**
 * Puts a demo site back to its starting state. Called on a schedule (see
 * vercel.json), so that whatever visitors change doesn't stay changed.
 *
 * Does nothing unless DEMO_MODE is on, and refuses anyone who doesn't send
 * the CRON_SECRET, so it can never wipe a real event.
 */
export async function GET(req: Request) {
  if (!demoMode()) return new Response("Not found", { status: 404 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET is not set", { status: 503 });
  const sent = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected))
    return new Response("Unauthorized", { status: 401 });

  const event = await getCurrentEvent();
  const result = await resetDemo(getPool(), event.id, { adminRole: demoAdminRole() });
  return Response.json({ ok: true, submissions: result.submissions, resetAt: new Date().toISOString() });
}
