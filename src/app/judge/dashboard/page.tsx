import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { getCurrentEvent } from "@/server/event";
import { getOwnProgress, listSubmissionsForJudging } from "@/server/judging";
import { getJudgeSession } from "../auth";
import { shuffleForUser } from "@/lib/shuffle";
import { JudgingNotOpen } from "../judging-not-open";
import { SignOutButton } from "./sign-out";
import { SubmissionList, type SubRow } from "./submission-list";

export const dynamic = "force-dynamic";

export default async function JudgeDashboard() {
  const phase = await getPhase();
  const judge = await getJudgeSession();
  if (!judge) redirect("/judge");
  const event = await getCurrentEvent();
  const viewer = { kind: "judge", judgeId: judge.id, role: judge.role } as const;

  const isMentor = judge.role === "mentor";

  if (phase === "submissions") {
    return (
      <>
        <HeaderBar rightSlot={<SignOutButton />} />
        <PageShell>
          <JudgingNotOpen />
        </PageShell>
      </>
    );
  }

  // Per-user randomized order so the bottom of the queue gets attention even
  // if a judge runs out of time. Stable across refreshes for the same user.
  const rawRows: SubRow[] = await listSubmissionsForJudging(event, viewer);
  const rows = shuffleForUser(rawRows, judge.id, (s) => s.id);

  // Recused projects stay listed but leave the judge's queue and progress.
  const progress = await getOwnProgress(event, viewer);
  const recusedIds = progress.recusedIds;
  const recused = new Set(recusedIds);
  const scoredIds = progress.scoredIds.filter((id) => !recused.has(id));

  const queueSize = rows.filter((r) => !recused.has(r.id)).length;
  const done = scoredIds.length;
  const pct = queueSize ? Math.round((done / queueSize) * 100) : 0;

  return (
    <>
      <HeaderBar
        rightSlot={
          <>
            <span className="hidden text-dust md:inline">
              Signed in as <span className="text-bone">{judge.name}</span>
              {isMentor && (
                <span className="ml-2 rounded-full border border-line bg-ink-4 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-dust">
                  Mentor
                </span>
              )}
            </span>
            <SignOutButton />
          </>
        }
      />
      <PageShell>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Judge", href: "/judge" },
            { label: "Dashboard" },
          ]}
        />
        <SectionTitle
          eyebrow={isMentor ? "Mentor · View Only" : `Phase: ${phase}`}
          title={isMentor ? "Mentor Dashboard" : "Judge Dashboard"}
          subtitle={
            isMentor
              ? phase === "results"
                ? "Voting is closed. The results page has the top 6, the leaderboard and the judges' notes."
                : "You have read-only access to every submission. You can't vote — that's by design."
              : phase === "judging"
                ? "Score each submission 1–5 on the rubric's five criteria, with one sentence of evidence for each score."
                : phase === "results"
                  ? "Voting is closed. Head to the results page."
                  : "Submissions are still open. Come back when judging opens."
          }
        />

        {!isMentor && (
          <div className="card mb-4 flex flex-wrap items-center gap-4">
            <div>
              <div className="field-label">Your Progress</div>
              <div className="font-display text-3xl text-crimson">
                {done} <span className="text-base text-dust">/ {queueSize}</span>
              </div>
              {recusedIds.length > 0 && (
                <div className="text-[0.65rem] uppercase tracking-wider text-dust">
                  {recusedIds.length} recused
                </div>
              )}
            </div>
            <div className="h-3 flex-1 overflow-hidden rounded-full border border-line bg-ink-5">
              <div
                className="h-full bg-gradient-to-r from-blood via-crimson to-jade transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="font-cond text-sm font-semibold uppercase tracking-wider text-bone">
              {pct}%
            </div>
            {phase === "results" && (
              <Link href="/results" className="btn-crimson">
                View Results →
              </Link>
            )}
          </div>
        )}

        {isMentor && phase === "results" && (
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-dust">
              Results are in: the top 6, the full leaderboard, and every
              judge&apos;s anonymized notes.
            </p>
            <Link href="/results" className="btn-crimson">
              View Results →
            </Link>
          </div>
        )}

        <SubmissionList
          rows={rows}
          scoredIds={scoredIds}
          recusedIds={recusedIds}
          canScore={!isMentor && phase === "judging"}
          mentorMode={isMentor}
        />
      </PageShell>
    </>
  );
}
