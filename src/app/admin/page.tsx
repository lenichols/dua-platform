import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { PhaseTrack, SignInLayout } from "@/components/sign-in-layout";
import { sampleAdminLogins } from "@/server/demo";
import { getAdminSession, type AdminSession } from "./auth";
import { AdminSignIn } from "./sign-in";
import { AdminHome } from "./admin-home";
import { getCurrentEvent } from "@/server/event";
import {
  getResultsLockForAdmin,
  judgingProgress,
  listRecusals,
  scoreActivity,
} from "@/server/admin-data";
import { listJudges } from "@/server/judges";
import { listRegistrations } from "@/server/registrations";
import { hasScores } from "@/server/settings";
import { listSubmissionsForAdmin } from "@/server/submissions";
import { canManageTeam } from "@/lib/admin-roles";
import { listCampaigns } from "@/lib/campaigns";
import { listAdminUsers } from "@/lib/admin-users";
import { siteUrl } from "@/lib/email";
import { editUrl } from "@/lib/submission-edit";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  const event = await getCurrentEvent();

  // Signed in, "Home" means the admin dashboard, not the public site (the
  // logo still goes there). AdminHome renders its own breadcrumbs.
  return (
    <>
      <HeaderBar
        rightSlot={
          session ? (
            <Link href="/admin" className="pill hover:border-accent hover:text-accent">
              ← Admin Home
            </Link>
          ) : (
            <Link href="/" className="pill hover:border-accent hover:text-accent">
              ← Home
            </Link>
          )
        }
      />
      <PageShell maxWidth="max-w-7xl">
        {!session ? (
          <div className="mx-auto max-w-5xl">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Admin" },
              ]}
            />
            <SignInLayout
              status="Organizers only"
              title="Admin Sign In"
              intro="Run the event from here: open and close the forms, manage judges, and publish results."
              aside={
                <PhaseTrack
                  phase={event.phase}
                  facts={[
                    { label: "Registration", value: event.registration_open ? "Open" : "Closed" },
                    { label: "Submission form", value: event.submissions_open ? "Open" : "Closed" },
                  ]}
                />
              }
            >
              <AdminSignIn samples={await sampleAdminLogins()} />
            </SignInLayout>
          </div>
        ) : (
          <AdminContent session={session} />
        )}
      </PageShell>
    </>
  );
}

async function AdminContent({ session }: { session: AdminSession }) {
  const event = await getCurrentEvent();
  const [judges, subs, progress, scores, lock, registrations, recusals] = await Promise.all([
    listJudges(event.id),
    // Everything the submission modal shows, so it opens instantly.
    listSubmissionsForAdmin(event.id),
    judgingProgress(event.id),
    scoreActivity(event.id),
    getResultsLockForAdmin(event.id),
    listRegistrations(event, { kind: "admin", role: session.role }),
    listRecusals(event.id),
  ]);

  // Only owners manage the admin roster, so only they pay for the query.
  const teamResult = canManageTeam(session.role) ? await listAdminUsers() : null;
  const campaignResult = await listCampaigns(event.id);

  // Build per-judge voting progress
  const scoresByJudge = new Map<
    string,
    { count: number; lastAt: string | null }
  >();
  scores.forEach((s) => {
    const prev = scoresByJudge.get(s.judge_id) ?? { count: 0, lastAt: null };
    prev.count += 1;
    if (!prev.lastAt || (s.updated_at && s.updated_at > prev.lastAt)) {
      prev.lastAt = s.updated_at;
    }
    scoresByJudge.set(s.judge_id, prev);
  });

  const visibleIds = new Set(
    (subs ?? [])
      .filter((s) => !s.hidden_from_judges && s.is_submission_complete)
      .map((s) => s.id),
  );
  const visibleCount = visibleIds.size;

  // A recused project leaves that judge's queue, so it comes off their total.
  const recusedByJudge = new Map<string, number>();
  (recusals ?? []).forEach((r) => {
    if (!visibleIds.has(r.submission_id)) return;
    recusedByJudge.set(r.judge_id, (recusedByJudge.get(r.judge_id) ?? 0) + 1);
  });
  const judgeNames = new Map((judges ?? []).map((j) => [j.id, j.name]));
  const projectNames = new Map((subs ?? []).map((s) => [s.id, s.project_name]));
  const conflicts = (recusals ?? []).map((r) => ({
    judge: judgeNames.get(r.judge_id) ?? "Unknown judge",
    project: projectNames.get(r.submission_id) ?? "Unknown project",
    reason: r.reason,
    created_at: r.created_at,
  }));

  // Mentors are read-only viewers — they don't vote, so exclude them from
  // the voting-progress math.
  const judgeProgress = (judges ?? [])
    .filter((j) => (j.role ?? "judge") === "judge")
    .map((j) => {
      const stats = scoresByJudge.get(j.id);
      return {
        id: j.id,
        name: j.name,
        email: j.email,
        is_active: j.is_active,
        scored: stats?.count ?? 0,
        total: visibleCount - (recusedByJudge.get(j.id) ?? 0),
        recused: recusedByJudge.get(j.id) ?? 0,
        last_scored_at: stats?.lastAt ?? null,
      };
    });

  return (
    <AdminHome
      phase={event.phase}
      judges={judges}
      submissions={subs.map((s) => ({
        ...s,
        // So organizers can resend a team's edit link from the modal.
        edit_url: editUrl(siteUrl(), s.id),
      }))}
      progress={progress}
      judgeProgress={judgeProgress}
      conflicts={conflicts}
      lock={lock}
      registrations={registrations.map((r) => ({
        ...r,
        role: r.role as "participant" | "mentor",
      }))}
      submissionsOpen={event.submissions_open}
      registrationOpen={event.registration_open}
      session={session}
      rubricLocked={await hasScores(event.id)}
      campaigns={campaignResult.ok ? campaignResult.campaigns : []}
      campaignsError={campaignResult.ok ? null : campaignResult.error}
      team={teamResult?.ok ? teamResult.users : []}
      teamError={teamResult && !teamResult.ok ? teamResult.error : null}
    />
  );
}
