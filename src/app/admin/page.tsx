import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle, Wordmark } from "@/components/shell";
import { getAdminSession, type AdminSession } from "./auth";
import { AdminSignIn } from "./sign-in";
import { AdminHome } from "./admin-home";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTeam } from "@/lib/admin-roles";
import { listCampaigns } from "@/lib/campaigns";
import { listAdminUsers } from "@/lib/admin-users";
import { siteUrl } from "@/lib/email";
import { editUrl } from "@/lib/submission-edit";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();

  // Signed in, "Home" means the admin dashboard, not the public site (the
  // logo still goes there). AdminHome renders its own breadcrumbs.
  return (
    <>
      <HeaderBar
        rightSlot={
          session ? (
            <Link href="/admin" className="pill hover:border-crimson hover:text-crimson">
              ← Admin Home
            </Link>
          ) : (
            <Link href="/" className="pill hover:border-crimson hover:text-crimson">
              ← Home
            </Link>
          )
        }
      />
      <PageShell maxWidth="max-w-7xl">
        {!session ? (
          <div className="mx-auto max-w-md">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Admin" },
              ]}
            />
            <div className="mb-4 flex justify-center">
              <Wordmark className="text-3xl md:text-4xl" />
            </div>
            <SectionTitle
              center
              eyebrow="Restricted"
              title="Admin Sign In"
              subtitle="Sign in with your admin account."
            />
            <AdminSignIn />
          </div>
        ) : (
          <AdminContent session={session} />
        )}
      </PageShell>
    </>
  );
}

async function AdminContent({ session }: { session: AdminSession }) {
  const admin = createAdminClient();
  // Try the new schema first (with `role`); fall back without `role` if the
  // 0002_mentors migration hasn't been applied yet.
  async function loadJudges() {
    const withRole = await admin
      .from("judges")
      .select("id, name, email, is_active, role, created_at")
      .order("name");
    if (!withRole.error) return withRole.data ?? [];
    const fallback = await admin
      .from("judges")
      .select("id, name, email, is_active, created_at")
      .order("name");
    return (fallback.data ?? []).map((j) => ({ ...j, role: "judge" as const }));
  }

  const [
    { data: state },
    judgesData,
    { data: subs },
    { data: progress },
    { data: scores },
    { data: lock },
    { data: registrations },
    { data: recusals },
  ] = await Promise.all([
    admin
      .from("event_state")
      .select("phase, updated_at, submissions_open, registration_open")
      .eq("id", 1)
      .maybeSingle(),
    loadJudges(),
    admin
      .from("submissions")
      .select(
        // Everything the submission modal shows, so it opens instantly.
        "id, project_name, team_name, solo_or_team, challenge_track, is_submission_complete, needs_review, review_note, hidden_from_judges, created_at, project_category, problem_brief, project_description_summary, project_description, problem_statement, core_energy_problem, disclosure_statement, technologies_used, energy_sector, impact_focus, solution_stage, customer_type, region, target_region, area_of_specification, applies_ai, team_size, github_url, live_demo_url, demo_video_url, demo_video_short_url, pitch_deck_url, summary_url, linkedin_post_url, all_members_in_video, member1_name, member1_email, phone, country, state_region, city, affiliated_org, submitter_role, submitter_linkedin_url, member2_name, member2_email, member2_linkedin_url, member2_occupation, member2_country, member3_name, member3_email, member3_linkedin_url, member3_occupation, member3_country, member4_name, member4_email, member4_linkedin_url, member4_occupation, member4_country, member5_name, member5_email, member5_linkedin_url, member5_occupation, member5_country, mentor_name, mentor_linkedin_url",
      )
      .order("created_at", { ascending: false }),
    admin.from("judging_progress").select("submission_id, project_name, votes"),
    admin.from("scores").select("judge_id, submission_id, updated_at"),
    admin.from("results_lock").select("seed, top6, locked_at").eq("id", 1).maybeSingle(),
    admin
      .from("registrations")
      .select(
        "id, full_name, email, phone, country, participating_as, team_name, primary_interest, experience_level, organization, occupation, partner_org, linkedin_url, website_url, heard_about, referred_by, role, created_at",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("recusals")
      .select("judge_id, submission_id, reason, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const judges = judgesData;

  // Only owners manage the admin roster, so only they pay for the query.
  const teamResult = canManageTeam(session.role) ? await listAdminUsers() : null;
  const campaignResult = await listCampaigns();

  // Build per-judge voting progress
  const scoresByJudge = new Map<
    string,
    { count: number; lastAt: string | null }
  >();
  (scores ?? []).forEach((s: { judge_id: string; updated_at: string | null }) => {
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
    reason: r.reason as string | null,
    created_at: r.created_at as string,
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
      phase={(state?.phase as "submissions" | "judging" | "results") ?? "submissions"}
      judges={judges ?? []}
      submissions={(subs ?? []).map((s) => ({
        ...s,
        // So organizers can resend a team's edit link from the modal.
        edit_url: editUrl(siteUrl(), s.id),
      }))}
      progress={progress ?? []}
      judgeProgress={judgeProgress}
      conflicts={conflicts}
      lock={lock ?? null}
      registrations={registrations ?? []}
      submissionsOpen={state?.submissions_open ?? false}
      registrationOpen={state?.registration_open ?? false}
      session={session}
      campaigns={campaignResult.ok ? campaignResult.campaigns : []}
      campaignsError={campaignResult.ok ? null : campaignResult.error}
      team={teamResult?.ok ? teamResult.users : []}
      teamError={teamResult && !teamResult.ok ? teamResult.error : null}
    />
  );
}
