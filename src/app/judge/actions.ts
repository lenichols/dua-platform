"use server";

import { revalidatePath } from "next/cache";
import { demoMode, isSampleEmail } from "@/lib/demo";
import { getViewer } from "@/lib/viewer";
import { getCurrentEvent } from "@/server/event";
import {
  declareConflict as declare,
  saveScore as save,
  withdrawConflict as withdraw,
} from "@/server/judging";
import { verifyJudgeSignIn } from "@/server/judges";
import {
  LOCKED_OUT_MESSAGE,
  clearFailures,
  isLockedOut,
  recordFailure,
  signInKey,
} from "@/server/rate-limit";
import { clearJudgeCookie, issueJudgeCookie } from "./auth";

type Result = { ok: true } | { ok: false; error: string };

// ── sign in / out ────────────────────────────────────────────────
export async function signInJudge(email: string, password: string): Promise<Result> {
  const key = signInKey("judge", email);
  // On a demo site the sample logins are public, so failed attempts on them
  // don't count: one visitor's typos mustn't lock everyone else out.
  const throttled = !(demoMode() && isSampleEmail(email));
  if (throttled && (await isLockedOut(key))) return { ok: false, error: LOCKED_OUT_MESSAGE };

  const event = await getCurrentEvent();
  const judge = await verifyJudgeSignIn(event.id, email, password);
  if (!judge) {
    if (throttled) await recordFailure(key);
    // One message for every failure, so it doesn't reveal who's on the roster.
    return { ok: false, error: "Wrong email or password. Check with the organizers." };
  }
  await clearFailures(key);
  await issueJudgeCookie(judge.id);
  return { ok: true };
}

export async function signOutJudge(): Promise<void> {
  await clearJudgeCookie();
}

// ── scoring and conflicts ────────────────────────────────────────
// The judge is always taken from the session, never from the request.

function revalidate(submissionId: string) {
  revalidatePath("/judge/dashboard");
  revalidatePath(`/judge/${submissionId}`);
  revalidatePath("/admin");
}

export async function saveScore(submissionId: string, values: unknown): Promise<Result> {
  const result = await save(await getCurrentEvent(), await getViewer(), submissionId, values);
  if (result.ok) revalidate(submissionId);
  return result;
}

export async function declareConflict(submissionId: string, reason: string): Promise<Result> {
  const result = await declare(await getCurrentEvent(), await getViewer(), submissionId, reason);
  if (result.ok) revalidate(submissionId);
  return result;
}

export async function withdrawConflict(submissionId: string): Promise<Result> {
  const result = await withdraw(await getCurrentEvent(), await getViewer(), submissionId);
  if (result.ok) revalidate(submissionId);
  return result;
}
