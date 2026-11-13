"use server";

import { revalidatePath } from "next/cache";
import { getJudgeByAuthUser } from "@/lib/judge-lookup";
import { getPhase } from "@/lib/phase";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

// Recusal. The judge is identified from their own
// session, never from the request, and the writes use the service role so
// the recusal and the removal of their score happen together.
async function requireJudge(): Promise<
  { ok: true; judgeId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };
  const judge = await getJudgeByAuthUser(supabase, user.id);
  if (!judge?.is_active || judge.role !== "judge")
    return { ok: false, error: "Only judges on the roster can recuse." };
  const phase = await getPhase();
  if (phase === "submissions")
    return { ok: false, error: "Judging hasn't started yet." };
  if (phase === "results")
    return { ok: false, error: "Voting has closed — contact the organizers." };
  return { ok: true, judgeId: judge.id };
}

function revalidate(submissionId: string) {
  revalidatePath("/judge/dashboard");
  revalidatePath(`/judge/${submissionId}`);
  revalidatePath("/admin");
}

export async function declareConflict(
  submissionId: string,
  reason: string,
): Promise<Result> {
  const guard = await requireJudge();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const { error } = await admin.from("recusals").upsert(
    {
      judge_id: guard.judgeId,
      submission_id: submissionId,
      reason: reason.trim().slice(0, 500) || null,
    },
    { onConflict: "judge_id,submission_id" },
  );
  if (error) return { ok: false, error: error.message };

  // A conflicted score mustn't count, even one entered before declaring.
  const { error: delErr } = await admin
    .from("scores")
    .delete()
    .eq("judge_id", guard.judgeId)
    .eq("submission_id", submissionId);
  if (delErr) return { ok: false, error: delErr.message };

  revalidate(submissionId);
  return { ok: true };
}

export async function withdrawConflict(submissionId: string): Promise<Result> {
  const guard = await requireJudge();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin
    .from("recusals")
    .delete()
    .eq("judge_id", guard.judgeId)
    .eq("submission_id", submissionId);
  if (error) return { ok: false, error: error.message };
  revalidate(submissionId);
  return { ok: true };
}
