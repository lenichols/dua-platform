"use client";

import {
  Fragment,
  ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/shell";
import { safeHref } from "@/lib/url";
import { EmailPanel, type CampaignRow } from "./email-panel";
import {
  ADMIN_ROLES,
  MIN_ADMIN_PASSWORD_LENGTH,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  canManageTeam,
  canWrite,
  type AdminRole,
} from "@/lib/admin-roles";
import {
  addAdminUser,
  addJudge,
  changeOwnPassword,
  computeAndLockTop6,
  createTestJudge,
  deleteRegistration,
  diagnoseJudgeSignIn,
  removeAdminUser,
  removeJudge,
  resetAdminUserPassword,
  setAdminUserActive,
  setAdminUserProtected,
  setAdminUserRole,
  setPhase,
  setRegistrationOpen,
  setSharedJudgePassword,
  setSubmissionsOpen,
  signOutAdmin,
  toggleHideSubmission,
} from "./actions";

type Phase = "submissions" | "judging" | "results";

type Session = {
  id: string;
  name: string;
  email: string | null;
  role: AdminRole;
  viaSharedPassword: boolean;
  isProtected: boolean;
};

type TeamMember = {
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

type Judge = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  role: "judge" | "mentor" | null;
  created_at: string;
};

type Submission = {
  id: string;
  project_name: string;
  team_name: string | null;
  solo_or_team: string | null;
  challenge_track: string | null;
  is_submission_complete: boolean | null;
  needs_review: boolean | null;
  hidden_from_judges: boolean | null;
  created_at: string;
  edit_url?: string;
} & Partial<Record<SubmissionDetailField, string | number | null>>;

// Shown in the submission modal. Loaded with the list so it opens instantly.
type SubmissionDetailField =
  | "review_note" | "project_category" | "problem_brief"
  | "project_description_summary" | "project_description"
  | "problem_statement" | "core_problem" | "disclosure_statement"
  | "technologies_used" | "focus_area" | "impact_focus" | "solution_stage"
  | "customer_type" | "region" | "target_region" | "area_of_specification"
  | "applies_ai" | "team_size" | "github_url" | "live_demo_url"
  | "demo_video_url" | "demo_video_short_url" | "pitch_deck_url" | "summary_url"
  | "linkedin_post_url" | "all_members_in_video" | "member1_name"
  | "member1_email" | "phone" | "country" | "state_region" | "city"
  | "affiliated_org" | "submitter_role" | "submitter_linkedin_url"
  | "mentor_name" | "mentor_linkedin_url"
  | `member${2 | 3 | 4 | 5}_${"name" | "email" | "linkedin_url" | "occupation" | "country"}`;

type Progress = {
  submission_id: string;
  project_name: string;
  votes: number;
};

type JudgeProgress = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  scored: number;
  total: number;
  recused: number;
  last_scored_at: string | null;
};

type Conflict = {
  judge: string;
  project: string;
  reason: string | null;
  created_at: string;
};

type Lock = {
  seed: number;
  top6: { submission_id: string; rank: number; probability: number }[];
  locked_at: string;
};

type Registration = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  participating_as: string | null;
  team_name: string | null;
  primary_interest: string | null;
  experience_level: string | null;
  organization: string | null;
  occupation: string | null;
  partner_org: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  heard_about: string | null;
  referred_by: string | null;
  role: "participant" | "mentor" | null;
  created_at: string;
};

type Tab =
  | "home"
  | "registrations"
  | "judges"
  | "submissions"
  | "results"
  | "team"
  | "email"
  | "account";

export function AdminHome({
  phase,
  judges,
  submissions,
  progress,
  judgeProgress,
  conflicts,
  lock,
  registrations,
  submissionsOpen,
  registrationOpen,
  session,
  team,
  teamError,
  campaigns,
  campaignsError,
}: {
  phase: Phase;
  judges: Judge[];
  submissions: Submission[];
  progress: Progress[];
  judgeProgress: JudgeProgress[];
  conflicts: Conflict[];
  lock: Lock | null;
  registrations: Registration[];
  submissionsOpen: boolean;
  registrationOpen: boolean;
  session: Session;
  team: TeamMember[];
  teamError: string | null;
  campaigns: CampaignRow[];
  campaignsError: string | null;
}) {
  const readOnly = !canWrite(session.role);
  const showTeam = canManageTeam(session.role);

  const tabs: Tab[] = [
    "home",
    "registrations",
    "judges",
    "submissions",
    "results",
    "email",
    ...(showTeam ? (["team"] as Tab[]) : []),
    // Every role gets this — changing your own password is self-service, not
    // an operational control.
    "account",
  ];

  // The tab lives in the URL (?tab=…) so any link to /admin lands on Home,
  // a reload keeps your place, and Back steps through tabs. pushState
  // updates useSearchParams without a server round trip.
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab") as Tab | null;
  const tab: Tab = requested && tabs.includes(requested) ? requested : "home";
  function setTab(t: Tab) {
    window.history.pushState(null, "", t === "home" ? "/admin" : `/admin?tab=${t}`);
  }

  return (
    <div>
      <Breadcrumbs
        items={
          tab === "home"
            ? [{ label: "Admin Home" }]
            : [{ label: "Admin Home", href: "/admin" }, { label: tab }]
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="hex-title text-4xl">Admin Control Center</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-right text-xs text-dust">
            <span className="font-semibold text-bone">{session.name}</span>
            {session.email && <span className="block">{session.email}</span>}
          </span>
          <RoleChip role={session.role} />
          <form action={signOutAdmin}>
            <button className="pill hover:border-blood hover:text-blood">Sign Out</button>
          </form>
        </div>
      </div>

      {readOnly && (
        <div className="mb-6 rounded-md border border-blue-600/40 bg-blue-600/10 px-4 py-3 text-sm text-bone">
          <span className="font-semibold">Read-only access.</span> You can see
          everything here — registration counts, judging progress, results — but
          controls that change data are hidden. Ask an owner if you need more.
        </div>
      )}

      {session.viaSharedPassword && showTeam && team.length === 0 && !teamError && (
        <div className="mb-6 rounded-md border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-bone">
          You&apos;re signed in with the shared admin password. Create named
          accounts under <span className="font-semibold">Team</span> so
          everyone gets their own login — and read-only teammates only get read
          access.
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md border px-4 py-2 font-cond text-sm uppercase tracking-wider transition ${
              tab === t
                ? "border-crimson bg-crimson/10 text-crimson"
                : "border-line bg-ink-4 text-dust hover:border-crimson/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <HomePanel
          phase={phase}
          judges={judges}
          submissions={submissions}
          progress={progress}
          judgeProgress={judgeProgress}
          conflicts={conflicts}
          submissionsOpen={submissionsOpen}
          registrationOpen={registrationOpen}
          registrationCount={registrations.length}
          readOnly={readOnly}
        />
      )}
      {tab === "registrations" && (
        <RegistrationsPanel registrations={registrations} readOnly={readOnly} />
      )}
      {tab === "judges" && <JudgesPanel judges={judges} readOnly={readOnly} />}
      {tab === "submissions" && (
        <SubmissionsPanel
          phase={phase}
          submissions={submissions}
          progress={progress}
          readOnly={readOnly}
        />
      )}
      {tab === "results" && (
        <ResultsPanel
          phase={phase}
          submissions={submissions}
          lock={lock}
          readOnly={readOnly}
        />
      )}
      {tab === "team" && showTeam && (
        <TeamPanel team={team} loadError={teamError} session={session} />
      )}
      {tab === "email" && (
        <EmailPanel
          campaigns={campaigns}
          loadError={campaignsError}
          defaultTestEmail={session.email ?? ""}
          readOnly={readOnly}
        />
      )}
      {tab === "account" && <AccountPanel session={session} />}
    </div>
  );
}

function AccountPanel({ session }: { session: Session }) {
  const [state, action, pending] = useActionState(changeOwnPassword, null);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="field-label mb-3">Your Account</div>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
          <Detail label="Name" value={session.name} />
          <Detail label="Email" value={session.email ?? "—"} />
          <Detail
            label="Role"
            value={
              <span className="inline-flex items-center gap-2">
                <RoleChip role={session.role} />
              </span>
            }
          />
        </div>
        <p className="mt-4 border-t border-line pt-4 text-xs text-dust">
          {ROLE_DESCRIPTIONS[session.role]}
        </p>
      </div>

      {session.viaSharedPassword ? (
        <div className="card border-l-4 border-l-blood">
          <div className="field-label mb-2">Change Password</div>
          <p className="text-sm text-dust">
            You're signed in with the{" "}
            <span className="text-bone">shared admin password</span>, which
            isn't tied to an account — so there's nothing here to change. That
            password lives in the <span className="font-mono">ADMIN_PASSWORD</span>{" "}
            environment variable and is rotated in Vercel.
          </p>
          <p className="mt-2 text-sm text-dust">
            To change a personal password, sign out and sign back in with your
            own email and password.
          </p>
        </div>
      ) : (
        <form action={action} className="card space-y-4">
          <div>
            <div className="field-label">Change Password</div>
            <p className="mt-1 text-xs text-dust">
              Changing this only affects your own sign-in. Everyone stays signed
              in on their existing sessions.
            </p>
          </div>

          {/* Helps password managers associate the change with the right account. */}
          <input
            type="hidden"
            name="username"
            autoComplete="username"
            value={session.email ?? ""}
            readOnly
          />

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="currentPassword">
                Current password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className="field-input mt-1"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="newPassword">
                New password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={MIN_ADMIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                className="field-input mt-1"
                placeholder={`≥ ${MIN_ADMIN_PASSWORD_LENGTH} characters`}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={MIN_ADMIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                className="field-input mt-1"
              />
            </div>
          </div>

          {state && !state.ok && (
            <div
              role="alert"
              className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood"
            >
              {state.error}
            </div>
          )}
          {state?.ok && (
            <div
              role="status"
              className="rounded-md border border-jade/60 bg-jade/10 px-3 py-2 text-xs text-jade"
            >
              ✓ Password changed. Use the new one next time you sign in.
            </div>
          )}

          <button className="btn-crimson" disabled={pending}>
            {pending ? "Saving…" : "🔑 Change Password"}
          </button>
        </form>
      )}
    </div>
  );
}

function RoleChip({ role }: { role: AdminRole }) {
  const styles: Record<AdminRole, string> = {
    owner: "border-crimson/50 bg-crimson/15 text-crimson",
    admin: "border-blue-600/50 bg-blue-600/15 text-blue-700",
    viewer: "border-line bg-ink-4 text-dust",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider ${styles[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function HomePanel({
  phase,
  judges,
  submissions,
  progress,
  judgeProgress,
  conflicts,
  submissionsOpen,
  registrationOpen,
  registrationCount,
  readOnly,
}: {
  phase: Phase;
  judges: Judge[];
  submissions: Submission[];
  progress: Progress[];
  judgeProgress: JudgeProgress[];
  conflicts: Conflict[];
  submissionsOpen: boolean;
  registrationOpen: boolean;
  registrationCount: number;
  readOnly: boolean;
}) {
  const [pending, start] = useTransition();
  const [subPending, startSub] = useTransition();
  const [subErr, setSubErr] = useState<string | null>(null);

  const [regPending, startReg] = useTransition();
  const [regErr, setRegErr] = useState<string | null>(null);
  function handleToggleReg() {
    setRegErr(null);
    startReg(async () => {
      const r = await setRegistrationOpen(!registrationOpen);
      if (!r.ok) {
        setRegErr(r.error);
        return;
      }
      window.location.reload();
    });
  }
  // /register and /mentor take sign-ups only with both gates open.
  const regLive = registrationOpen && phase === "submissions";

  function handleToggleSubs() {
    setSubErr(null);
    startSub(async () => {
      const r = await setSubmissionsOpen(!submissionsOpen);
      if (!r.ok) {
        setSubErr(r.error);
        return;
      }
      window.location.reload();
    });
  }
  const activeJudges = judges.filter(
    (j) => j.is_active && (j.role ?? "judge") === "judge",
  ).length;
  const activeMentors = judges.filter(
    (j) => j.is_active && j.role === "mentor",
  ).length;
  const visibleSubs = submissions.filter(
    (s) => !s.hidden_from_judges && s.is_submission_complete,
  );

  // Per-judge truth is the source for the progress bar — it only counts scores
  // on currently-visible submissions and clamps overages so the bar never goes >100%.
  const activeJudgeProgress = judgeProgress.filter((j) => j.is_active);
  const cast = activeJudgeProgress.reduce(
    (t, j) => t + Math.min(j.scored, j.total),
    0,
  );
  const totalPossibleVotes = activeJudgeProgress.reduce(
    (t, j) => t + j.total,
    0,
  );
  const pct =
    totalPossibleVotes > 0
      ? Math.round((cast / totalPossibleVotes) * 100)
      : 0;

  const stragglers = activeJudgeProgress.filter(
    (j) => j.scored < j.total,
  ).length;
  // Until judging starts, submissions are the news; after, judges are.
  const duringSubmissions = phase === "submissions";
  // /submit takes projects only when both gates are open.
  const live = submissionsOpen && duringSubmissions;

  const [phaseErr, setPhaseErr] = useState<string | null>(null);

  function handlePhase(p: Phase) {
    setPhaseErr(null);
    start(async () => {
      try {
        const r = await setPhase(p);
        if (!r.ok) {
          setPhaseErr(r.error);
          return;
        }
        if (r.persisted !== p) {
          setPhaseErr(
            `The database shows phase "${r.persisted}" after writing "${p}" (rows changed: ${r.rowsAffected}). Reload and try again.`,
          );
          return;
        }
        // Hard reload — guarantees the phase pill updates everywhere even if
        // RSC payload caching gets in the way.
        window.location.reload();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPhaseErr(`Couldn't switch phase: ${msg}`);
      }
    });
  }

  const judgeStatus = (
    <div className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="field-label">Judge Voting Status</div>
          <div className="mt-1 text-[0.7rem] text-dust">
            {stragglers > 0
              ? `${stragglers} judge${stragglers === 1 ? "" : "s"} still need${stragglers === 1 ? "s" : ""} to finish.`
              : "All active judges have completed their scoring."}
          </div>
        </div>
        {activeJudgeProgress.length > 0 && (
          <div className="text-[0.65rem] uppercase tracking-wider text-dust">
            Active: {activeJudgeProgress.length}
          </div>
        )}
      </div>

      {activeJudgeProgress.length === 0 ? (
        <p className="text-sm text-dust">
          No active judges yet. Add some in the Judges tab.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {activeJudgeProgress
            .slice()
            .sort((a, b) => a.scored / (a.total || 1) - b.scored / (b.total || 1))
            .map((j) => {
              const pctJ =
                j.total > 0 ? Math.round((j.scored / j.total) * 100) : 0;
              const status =
                j.scored === 0
                  ? "not_started"
                  : j.scored >= j.total
                    ? "done"
                    : "in_progress";
              return (
                <li
                  key={j.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-bone">
                        {j.name}
                      </span>
                      {status === "done" && (
                        <span className="pill-crimson">✓ Done</span>
                      )}
                      {status === "in_progress" && (
                        <span className="rounded-full border border-crimson/40 bg-crimson/10 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-crimson">
                          In Progress
                        </span>
                      )}
                      {status === "not_started" && (
                        <span className="rounded-full border border-blood/60 bg-blood/10 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-blood">
                          Not Started
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[0.7rem] text-dust">
                      {j.email}
                      {j.recused > 0 && (
                        <span className="ml-2">· {j.recused} recused</span>
                      )}
                      {j.last_scored_at && (
                        <span className="ml-2">
                          · last vote{" "}
                          {new Date(j.last_scored_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-40 flex-col items-end gap-1">
                    <div className="text-xs">
                      <span className="font-display text-lg text-bone">
                        {j.scored}
                      </span>
                      <span className="text-dust"> / {j.total}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-5">
                      <div
                        className={`h-full transition-all ${
                          status === "done"
                            ? "bg-jade"
                            : status === "not_started"
                              ? "bg-blood"
                              : "bg-crimson"
                        }`}
                        style={{ width: `${pctJ}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-dust">
        Admin Home is the event at a glance: the current phase, the submission
        form, submissions and judging progress. The other tabs manage each
        piece in detail.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <div className="field-label mb-3">Current Phase</div>
          <div className="mb-5 flex gap-2">
            {(["submissions", "judging", "results"] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePhase(p)}
                disabled={readOnly || pending || p === phase}
                title={readOnly ? "Read-only access" : undefined}
                className={`flex-1 rounded-md border px-3 py-4 font-cond uppercase tracking-wider transition ${
                  phase === p
                    ? "border-crimson bg-crimson/20 text-crimson"
                    : "border-line bg-ink-4 text-dust hover:border-crimson/60"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {phaseErr && (
            <div className="mb-3 rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
              {phaseErr}
            </div>
          )}
          <p className="text-xs text-dust">
            {readOnly ? (
              <>
                The event is currently in the{" "}
                <span className="text-crimson">{phase}</span> phase. Only owners
                and admins can change it.
              </>
            ) : (
              <>
                Changing to <span className="text-crimson">judging</span> locks
                submissions. Changing to{" "}
                <span className="text-crimson">results</span> reveals aggregated
                scores; if you haven&apos;t computed the top-6 yet, do that from
                the Results tab first.
              </>
            )}
          </p>
        </div>

        <div className="card">
          <div className="field-label">Voting Progress</div>
          <div className="mt-2 font-display text-5xl text-crimson">{pct}%</div>
          <div className="mt-1 text-xs text-dust">
            {cast} / {totalPossibleVotes} votes cast
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full border border-line bg-ink-5">
            <div
              className="h-full bg-gradient-to-r from-blood via-crimson to-jade transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <Stat label="Judges" v={activeJudges} />
            <Stat label="Mentors" v={activeMentors} />
            <Stat label="Submissions" v={visibleSubs.length} />
          </div>
        </div>
      </div>

      {/* Green while /submit is actually taking projects; grey and hatched,
          like a shuttered window, once it isn't. Each button previews the
          state it switches to on hover. */}
      <div
        className={`card border-l-4 transition-colors ${
          live
            ? "border-go/40 border-l-go bg-gradient-to-r from-go/[0.18] via-go/[0.09] to-go/[0.05] shadow-[0_12px_32px_-14px_rgb(var(--go)/0.55)]"
            : "border-line border-l-dust/40 bg-ink-4"
        }`}
        style={
          live
            ? undefined
            : {
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgb(var(--line) / 0.5) 0 1px, transparent 1px 11px)",
              }
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <span
              className={`relative mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${
                live ? "bg-go/15 ring-go/40" : "bg-ink-5 ring-line"
              }`}
              aria-hidden
            >
              {live ? (
                <>
                  <span className="absolute h-3 w-3 rounded-full bg-go/60 motion-safe:animate-ping" />
                  <span className="relative h-3 w-3 rounded-full bg-go" />
                </>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-dust" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              )}
            </span>
            <div>
              <span className={`field-label !mb-0 ${live ? "text-go-ink/80" : ""}`}>
                Submission Form
              </span>
              <div
                className={`mt-0.5 font-display text-3xl tracking-wider ${
                  live ? "text-go" : "text-dust"
                }`}
              >
                {live ? "Accepting submissions" : "Submissions closed"}
              </div>
              <p className={`mt-1 max-w-xl text-sm ${live ? "text-go-ink" : "text-dust"}`}>
                {live ? (
                  <>
                    Anyone with the link can submit at /submit.{" "}
                    <a
                      href="/submit"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline decoration-go/50 underline-offset-2 hover:decoration-go"
                    >
                      View form ↗
                    </a>
                  </>
                ) : (
                  "/submit is locked: no new submissions, and edit links no longer work. Registration has its own switch below."
                )}
                {phase !== "submissions" && (
                  <span className="mt-1 block text-[0.7rem]">
                    Note: submissions also require the <b>submissions</b> phase
                    (currently <b>{phase}</b>).
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div
                className={`font-display text-4xl leading-none ${
                  live ? "text-go" : "text-dust"
                }`}
              >
                {submissions.length}
              </div>
              <div
                className={`mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.15em] ${
                  live ? "text-go-ink/80" : "text-dust"
                }`}
              >
                Received
              </div>
            </div>
            {!readOnly && (
              <button
                onClick={handleToggleSubs}
                disabled={subPending}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-5 font-cond text-sm font-semibold uppercase tracking-wider transition disabled:opacity-60 ${
                  live
                    ? "border-go/50 bg-ink-2/80 text-go-ink hover:border-line hover:bg-ink-5 hover:text-dust"
                    : submissionsOpen
                      ? // switched on, but the phase has moved past submissions
                        "border-line bg-ink-3 text-dust hover:border-dust hover:text-bone"
                      : "border-line bg-ink-3 text-bone hover:border-go hover:bg-go hover:text-ink"
                }`}
              >
                {subPending
                  ? "Saving…"
                  : submissionsOpen
                    ? "Close submissions"
                    : "Open submissions"}
              </button>
            )}
          </div>
        </div>
        {subErr && (
          <div className="mt-3 rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
            {subErr}
          </div>
        )}
      </div>

      {/* Registration: the Submission Form card's colours, in one row. */}
      <div
        className={`card border-l-4 py-4 transition-colors ${
          regLive
            ? "border-go/40 border-l-go bg-gradient-to-r from-go/[0.18] via-go/[0.09] to-go/[0.05]"
            : "border-line border-l-dust/40 bg-ink-4"
        }`}
        style={
          regLive
            ? undefined
            : {
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgb(var(--line) / 0.5) 0 1px, transparent 1px 11px)",
              }
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${regLive ? "bg-go" : "bg-dust/60"}`}
              aria-hidden
            />
            <div>
              <span className={`field-label !mb-0 ${regLive ? "text-go-ink/80" : ""}`}>
                Registration
              </span>
              <div className={`font-display text-xl tracking-wider ${regLive ? "text-go" : "text-dust"}`}>
                {regLive ? "Open" : "Closed"}
                <span className="ml-2 font-body text-xs normal-case tracking-normal">
                  {registrationCount} registered
                </span>
              </div>
              <p className={`text-xs ${regLive ? "text-go-ink" : "text-dust"}`}>
                Participant registration (/register) and mentor sign-up (/mentor).
                {phase !== "submissions" && " Always closed once judging starts."}
              </p>
            </div>
          </div>
          {!readOnly && (
            <button
              onClick={handleToggleReg}
              disabled={regPending}
              className={`inline-flex h-10 items-center justify-center rounded-md border px-4 font-cond text-sm font-semibold uppercase tracking-wider transition disabled:opacity-60 ${
                regLive
                  ? "border-go/50 bg-ink-2/80 text-go-ink hover:border-line hover:bg-ink-5 hover:text-dust"
                  : registrationOpen
                    ? "border-line bg-ink-3 text-dust hover:border-dust hover:text-bone"
                    : "border-line bg-ink-3 text-bone hover:border-go hover:bg-go hover:text-ink"
              }`}
            >
              {regPending
                ? "Saving…"
                : registrationOpen
                  ? "Close registration"
                  : "Open registration"}
            </button>
          )}
        </div>
        {regErr && (
          <div className="mt-3 rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
            {regErr}
          </div>
        )}
      </div>

      {duringSubmissions ? (
        <>
          <div className="card">
            <div className="field-label">Submissions ({submissions.length})</div>
            <div className="mb-3 mt-1 text-[0.7rem] text-dust">
              Newest first. Click a submission to see everything the team sent.
            </div>
            <SubmissionsTable
              submissions={submissions}
              progress={progress}
              readOnly={readOnly}
              showScores={false}
            />
          </div>
          {judgeStatus}
        </>
      ) : (
        <>
          {judgeStatus}
          <details className="group card p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-start gap-3">
                <span className="mt-0.5 inline-block text-[0.7rem] text-dust transition-transform group-open:rotate-90">
                  ▶
                </span>
                <span>
                  <span className="block font-cond text-sm font-bold uppercase tracking-wider text-bone">
                    Submissions ({submissions.length})
                  </span>
                  <span className="mt-0.5 block text-xs text-dust">
                    Submissions are locked. Open to browse them and see how
                    many judges have scored each.
                  </span>
                </span>
              </span>
            </summary>
            <div className="border-t border-line p-5">
              <SubmissionsTable
                submissions={submissions}
                progress={progress}
                readOnly={readOnly}
                showScores
              />
            </div>
          </details>
        </>
      )}

      <div className="card">
        <div className="field-label">Declared Conflicts</div>
        <div className="mt-1 text-[0.7rem] text-dust">
          Judges recuse themselves from a project on its page. It leaves their
          queue and progress, and any score they gave it is removed.
        </div>
        {conflicts.length === 0 ? (
          <p className="mt-3 text-sm text-dust">None declared.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {conflicts.map((c, i) => (
              <li key={i} className="py-2 text-sm">
                <span className="font-semibold text-bone">{c.judge}</span>
                <span className="text-dust"> · recused from </span>
                <span className="font-semibold text-bone">{c.project}</span>
                <span className="ml-2 text-[0.7rem] text-dust">
                  {new Date(c.created_at).toLocaleString()}
                </span>
                {c.reason && (
                  <p className="mt-0.5 text-xs text-dust">“{c.reason}”</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Judges & mentors ─────────────────────────────────────────────
// Roster first: one unified table (judges + mentors) with role filter pills,
// sortable columns and zebra rows — same visual language as the Registrations
// tab. The add form sits under it; the three sign-in utilities live in a
// collapsed disclosure so they stop competing with the roster.

type RosterSortKey = "name" | "role" | "status" | "created_at";

const roleOf = (j: Judge): "judge" | "mentor" =>
  j.role === "mentor" ? "mentor" : "judge";

function JudgesPanel({
  judges,
  readOnly,
}: {
  judges: Judge[];
  readOnly: boolean;
}) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "judge" | "mentor">(
    "all",
  );
  const [sort, setSort] = useState<{ key: RosterSortKey; dir: "asc" | "desc" }>(
    { key: "name", dir: "asc" },
  );
  const [rosterErr, setRosterErr] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startRemove] = useTransition();

  const judgeTotal = judges.filter((j) => roleOf(j) === "judge").length;
  const mentorTotal = judges.length - judgeTotal;
  const activeJudges = judges.filter(
    (j) => roleOf(j) === "judge" && j.is_active,
  ).length;
  const activeMentors = judges.filter(
    (j) => roleOf(j) === "mentor" && j.is_active,
  ).length;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = judges.filter((j) => {
      if (roleFilter !== "all" && roleOf(j) !== roleFilter) return false;
      if (!needle) return true;
      return [j.name, j.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
    const { key, dir } = sort;
    list.sort((a, b) => {
      let cmp: number;
      if (key === "created_at") {
        cmp =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (key === "status") {
        cmp = Number(a.is_active) - Number(b.is_active);
      } else {
        const av = key === "role" ? roleOf(a) : a.name;
        const bv = key === "role" ? roleOf(b) : b.name;
        cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
          sensitivity: "base",
        });
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [judges, q, roleFilter, sort]);

  function toggleSort(key: RosterSortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "created_at" || key === "status" ? "desc" : "asc" },
    );
  }

  function onRemove(id: string) {
    setRosterErr(null);
    setRemovingId(id);
    startRemove(async () => {
      const r = await removeJudge(id);
      if (!r.ok) setRosterErr(r.error);
      setRemovingId(null);
    });
  }

  const filtering = q.trim() !== "" || roleFilter !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-cond text-sm font-bold uppercase tracking-wider text-bone">
            Roster
          </span>
          <span className="pill-crimson">
            {filtering ? `${rows.length} / ${judges.length}` : judges.length}
          </span>
          <div className="ml-2 flex gap-1">
            {(
              [
                ["all", "All"],
                ["judge", `Judges (${judgeTotal})`],
                ["mentor", `Mentors (${mentorTotal})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRoleFilter(k)}
                aria-pressed={roleFilter === k}
                className={
                  roleFilter === k
                    ? "pill-crimson"
                    : "pill hover:border-crimson hover:text-crimson"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search roster by name or email"
          placeholder="Search name or email…"
          className="field-input w-full sm:w-64"
        />
      </div>

      <p className="text-xs text-dust">
        <span className="font-semibold text-bone">
          {activeJudges} judge{activeJudges === 1 ? "" : "s"}
        </span>{" "}
        and{" "}
        <span className="font-semibold text-bone">
          {activeMentors} mentor{activeMentors === 1 ? "" : "s"}
        </span>{" "}
        can sign in at <span className="text-crimson">/judge</span> right now.
        Inactive people keep their row but lose access.
      </p>

      {rosterErr && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {rosterErr}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card text-center text-dust">
          {filtering
            ? "Nobody on the roster matches your filters."
            : "No judges or mentors yet."}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-line bg-ink-4/50 text-left text-[0.62rem] font-bold uppercase tracking-[0.14em] text-dust">
                  <SortableTh
                    label="Name"
                    sortKey="name"
                    sort={sort}
                    onSort={toggleSort}
                    className="pl-4 pr-3"
                  />
                  <SortableTh
                    label="Role"
                    sortKey="role"
                    sort={sort}
                    onSort={toggleSort}
                    className="pr-3"
                  />
                  <SortableTh
                    label="Status"
                    sortKey="status"
                    sort={sort}
                    onSort={toggleSort}
                    className="pr-3"
                  />
                  <SortableTh
                    label="Added"
                    sortKey="created_at"
                    sort={sort}
                    onSort={toggleSort}
                    className={`hidden md:table-cell ${
                      readOnly ? "pr-4 text-right" : "pr-3"
                    }`}
                    align={readOnly ? "right" : "left"}
                  />
                  {!readOnly && (
                    <th className="py-3 pr-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((j, i) => {
                  const role = roleOf(j);
                  const zebra = i % 2 === 1;
                  const added = new Date(j.created_at).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  );
                  return (
                    <tr
                      key={j.id}
                      className={`border-b border-line/70 ${
                        zebra ? "bg-ink-4/40" : ""
                      }`}
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="font-semibold text-bone">{j.name}</div>
                        <a
                          href={`mailto:${j.email}`}
                          className="block max-w-[240px] truncate text-xs text-dust hover:text-crimson hover:underline"
                        >
                          {j.email}
                        </a>
                      </td>
                      <td className="py-3 pr-3">
                        <PersonRoleBadge role={role} />
                      </td>
                      <td className="py-3 pr-3">
                        {j.is_active ? (
                          <span className="pill-crimson">Active</span>
                        ) : (
                          <span className="pill">Inactive</span>
                        )}
                      </td>
                      <td
                        className={`hidden whitespace-nowrap py-3 text-xs text-dust md:table-cell ${
                          readOnly ? "pr-4 text-right" : "pr-3"
                        }`}
                      >
                        {added}
                      </td>
                      {!readOnly && (
                        <td className="py-3 pr-4 text-right">
                          {j.is_active && (
                            <button
                              onClick={() => onRemove(j.id)}
                              disabled={removingId === j.id}
                              className="pill hover:border-blood hover:text-blood disabled:opacity-40"
                            >
                              {removingId === j.id
                                ? "Removing…"
                                : "Deactivate"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          <AddPersonForm />
          <SignInTools />
        </>
      )}
    </div>
  );
}

function PersonRoleBadge({ role }: { role: "judge" | "mentor" }) {
  if (role === "mentor") {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-600/50 bg-blue-600/15 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-blue-700">
        Mentor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-crimson/50 bg-crimson/15 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-crimson">
      Judge
    </span>
  );
}

// One form for both roles — the role selector sets the `role` field that
// addJudge reads ("judge" | "mentor").
function AddPersonForm() {
  const [state, setState] = useState<
    | { ok: true; role: "judge" | "mentor"; name: string }
    | { ok: false; error: string }
    | null
  >(null);
  const [pending, start] = useTransition();

  function onAdd(fd: FormData) {
    const role =
      String(fd.get("role") ?? "judge") === "mentor" ? "mentor" : "judge";
    const name = String(fd.get("name") ?? "").trim();
    fd.set("role", role);
    start(async () => {
      const r = await addJudge(null, fd);
      setState(r.ok ? { ok: true, role, name } : { ok: false, error: r.error });
      if (r.ok) {
        (
          document.getElementById("add-person-form") as HTMLFormElement | null
        )?.reset();
      }
    });
  }

  return (
    <form id="add-person-form" action={onAdd} className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="pill-crimson">Add to roster</div>
        <span className="text-[0.65rem] uppercase tracking-wider text-dust">
          They sign in at /judge
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_auto_auto]">
        <div>
          <label className="field-label" htmlFor="add-person-name">
            Name
          </label>
          <input
            id="add-person-name"
            name="name"
            required
            className="field-input mt-1"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="add-person-email">
            Email
          </label>
          <input
            id="add-person-email"
            name="email"
            type="email"
            required
            className="field-input mt-1"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="add-person-role">
            Role
          </label>
          <select
            id="add-person-role"
            name="role"
            defaultValue="judge"
            className="field-input mt-1 md:w-32"
          >
            <option value="judge">Judge</option>
            <option value="mentor">Mentor</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-crimson w-full md:w-auto" disabled={pending}>
            {pending ? "Adding…" : "+ Add"}
          </button>
        </div>
      </div>

      <p className="text-[0.7rem] text-dust">
        <span className="font-semibold text-bone">Judges</span> score
        submissions and shape the top-6.{" "}
        <span className="font-semibold text-bone">Mentors</span> can view every
        submission but cannot vote — use them for advisors, partners and
        observers. Nobody gets an email from this; give them a password with{" "}
        <span className="text-bone">Sign-in tools</span> below.
      </p>

      {state?.ok && (
        <div className="rounded-md border border-jade/60 bg-jade/10 px-3 py-2 text-xs text-jade">
          ✓ Added {state.name || "them"} as a {state.role}. Set or re-apply the
          shared password so they can sign in.
        </div>
      )}
      {state && !state.ok && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {state.error}
        </div>
      )}
    </form>
  );
}

// ── Sign-in tools (collapsed by default) ─────────────────────────
function SignInTools() {
  return (
    <details className="group card p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-start gap-3">
          <span className="mt-0.5 inline-block text-[0.7rem] text-dust transition-transform group-open:rotate-90">
            ▶
          </span>
          <span>
            <span className="block font-cond text-sm font-bold uppercase tracking-wider text-bone">
              Sign-in tools
            </span>
            <span className="mt-0.5 block text-xs text-dust">
              Set the shared password, create a test account, or diagnose a
              failed sign-in.
            </span>
          </span>
        </span>
        <span className="pill shrink-0">Troubleshooting</span>
      </summary>
      <div className="space-y-8 border-t border-line p-5">
        <SharedPasswordTool />
        <TestAccountTool />
        <DiagnoseTool />
      </div>
    </details>
  );
}

function ToolHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-cond text-sm font-bold uppercase tracking-wider text-bone">
        {title}
      </h3>
      <span className="text-[0.65rem] uppercase tracking-wider text-dust">
        {hint}
      </span>
    </div>
  );
}

function SharedPasswordTool() {
  const [pwdState, setPwdState] = useState<
    | { ok: true; updated: number }
    | { ok: false; error: string }
    | null
  >(null);
  const [pwdPending, pwdStart] = useTransition();

  function onSetPassword(fd: FormData) {
    pwdStart(async () => {
      const r = await setSharedJudgePassword(null, fd);
      setPwdState(r);
      if (r.ok) {
        (document.getElementById("pwd-form") as HTMLFormElement | null)?.reset();
      }
    });
  }

  return (
    <form id="pwd-form" action={onSetPassword} className="space-y-3">
      <ToolHeading
        title="Shared sign-in password"
        hint="One password for the whole panel"
      />
      <p className="text-xs text-dust">
        Sets one password on every <strong className="text-bone">active</strong>{" "}
        judge and mentor. They sign in at{" "}
        <span className="text-crimson">/judge</span> with their email + this
        password — no email is sent. Share it directly (Slack/text). Re-run any
        time to rotate it.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="field-label" htmlFor="pwd-password">
            Password (min 8 chars)
          </label>
          <input
            id="pwd-password"
            name="password"
            type="text"
            required
            minLength={6}
            autoComplete="off"
            className="field-input mt-1"
            placeholder="e.g. a long passphrase"
          />
        </div>
        <button className="btn-crimson" disabled={pwdPending}>
          {pwdPending ? "Applying…" : "🔐 Set & Apply"}
        </button>
      </div>
      {pwdState && pwdState.ok && (
        <div className="space-y-2">
          <div className="rounded-md border border-jade/60 bg-jade/10 px-3 py-2 text-xs text-jade">
            ✓ Updated {pwdState.updated} user{pwdState.updated === 1 ? "" : "s"}.
            Share the password now — it&apos;s set.
          </div>
        </div>
      )}
    </form>
  );
}

function TestAccountTool() {
  const [testState, setTestState] = useState<
    { ok: true; email: string } | { ok: false; error: string } | null
  >(null);
  const [testPending, testStart] = useTransition();

  function onCreateTest(fd: FormData) {
    testStart(async () => {
      const r = await createTestJudge(null, fd);
      setTestState(r);
      if (r.ok) {
        (
          document.getElementById("test-form") as HTMLFormElement | null
        )?.reset();
      }
    });
  }

  return (
    <form
      id="test-form"
      action={onCreateTest}
      className="space-y-3 border-t border-line pt-8"
    >
      <ToolHeading
        title="Test account"
        hint="For verifying the sign-in flow"
      />
      <p className="text-xs text-dust">
        Creates a one-off judge or mentor with a known email + password —
        independent of the shared password above. Use it to walk the{" "}
        <span className="text-crimson">/judge</span> sign-in flow yourself.
        Deactivate it from the roster when you&apos;re done.
      </p>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label className="field-label" htmlFor="test-email">
            Email
          </label>
          <input
            id="test-email"
            name="email"
            type="email"
            required
            className="field-input mt-1"
            placeholder="test@example.org"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="test-password">
            Password
          </label>
          <input
            id="test-password"
            name="password"
            type="text"
            required
            minLength={6}
            autoComplete="off"
            className="field-input mt-1"
            placeholder="≥ 6 chars"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="test-role">
            Role
          </label>
          <select
            id="test-role"
            name="role"
            defaultValue="judge"
            className="field-input mt-1"
          >
            <option value="judge">Judge</option>
            <option value="mentor">Mentor</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn" disabled={testPending}>
            {testPending ? "Creating…" : "+ Create"}
          </button>
        </div>
      </div>
      <input name="name" type="hidden" value="Test Account" />
      {testState && testState.ok && (
        <div className="rounded-md border border-jade/60 bg-jade/10 px-3 py-2 text-xs text-jade">
          ✓ Created <span className="font-mono">{testState.email}</span>. Sign
          in at <span className="text-crimson">/judge</span> with that email +
          the password you just typed.
        </div>
      )}
      {testState && !testState.ok && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {testState.error}
        </div>
      )}
    </form>
  );
}

type DiagOk = {
  ok: true;
  onRoster: boolean;
  isActive: boolean | null;
  hasPassword: boolean;
  passwordMatches: boolean;
  lockedOut: boolean;
  wouldSignIn: boolean;
};

function DiagLine({ label, good, value }: { label: string; good: boolean; value: string }) {
  return (
    <div>
      {label}: <span className={good ? "text-jade" : "text-blood"}>{value}</span>
    </div>
  );
}

function DiagnoseTool() {
  const [diagState, setDiagState] = useState<
    DiagOk | { ok: false; error: string } | null
  >(null);
  const [diagPending, diagStart] = useTransition();

  function onDiagnose(fd: FormData) {
    diagStart(async () => {
      const r = await diagnoseJudgeSignIn(null, fd);
      setDiagState(r);
    });
  }

  return (
    <form
      id="diag-form"
      action={onDiagnose}
      className="space-y-3 border-t border-line pt-8"
    >
      <ToolHeading
        title="Diagnose sign-in"
        hint={"For debugging “wrong email or password”"}
      />
      <p className="text-xs text-dust">
        Enter a judge&apos;s email + the password you expect. Shows whether
        they&apos;re on the roster, whether they&apos;re active, whether a
        password has been set, and whether this one matches.
      </p>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="field-label" htmlFor="diag-email">
            Email
          </label>
          <input
            id="diag-email"
            name="email"
            type="email"
            required
            className="field-input mt-1"
            placeholder="judge@example.org"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="diag-password">
            Password
          </label>
          <input
            id="diag-password"
            name="password"
            type="text"
            required
            autoComplete="off"
            className="field-input mt-1"
            placeholder="a long passphrase"
          />
        </div>
        <div className="flex items-end">
          <button className="btn" disabled={diagPending}>
            {diagPending ? "Checking…" : "🔎 Diagnose"}
          </button>
        </div>
      </div>
      {diagState && diagState.ok && (
        <div className="rounded-md border border-line bg-ink-4 px-3 py-2 font-mono text-[0.7rem] text-bone">
          <DiagLine label="on the roster" good={diagState.onRoster} value={String(diagState.onRoster)} />
          <DiagLine
            label="active"
            good={diagState.isActive === true}
            value={diagState.isActive === null ? "—" : String(diagState.isActive)}
          />
          <DiagLine label="password set" good={diagState.hasPassword} value={String(diagState.hasPassword)} />
          <DiagLine label="password matches" good={diagState.passwordMatches} value={String(diagState.passwordMatches)} />
          <DiagLine
            label="locked out after failed attempts"
            good={!diagState.lockedOut}
            value={String(diagState.lockedOut)}
          />
          <DiagLine
            label="sign-in result"
            good={diagState.wouldSignIn}
            value={diagState.wouldSignIn ? "success" : "failed"}
          />
        </div>
      )}
      {diagState && !diagState.ok && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {diagState.error}
        </div>
      )}
    </form>
  );
}

const REG_PAGE_SIZE = 30;

type SortKey =
  | "full_name"
  | "role"
  | "country"
  | "primary_interest"
  | "created_at";

function RegistrationsPanel({
  registrations,
  readOnly,
}: {
  registrations: Registration[];
  readOnly: boolean;
}) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "participant" | "mentor"
  >("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "created_at",
    dir: "desc",
  });

  // Jump back to page 1 whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [q, roleFilter, sort]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return registrations.filter((r) => {
      if (roleFilter !== "all" && (r.role ?? "participant") !== roleFilter)
        return false;
      if (!needle) return true;
      return [
        r.full_name,
        r.email,
        r.phone,
        r.country,
        r.team_name,
        r.organization,
        r.occupation,
        r.primary_interest,
        r.experience_level,
        r.partner_org,
        r.heard_about,
        r.referred_by,
        r.participating_as,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [q, roleFilter, registrations]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let cmp: number;
      if (key === "created_at") {
        cmp =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        const av = (key === "role" ? a.role ?? "participant" : a[key]) ?? "";
        const bv = (key === "role" ? b.role ?? "participant" : b[key]) ?? "";
        cmp = String(av).localeCompare(String(bv), undefined, {
          sensitivity: "base",
        });
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "created_at" ? "desc" : "asc" },
    );
  }

  const mentorCount = registrations.filter((r) => r.role === "mentor").length;

  const totalPages = Math.max(1, Math.ceil(sorted.length / REG_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice(
    (safePage - 1) * REG_PAGE_SIZE,
    safePage * REG_PAGE_SIZE,
  );

  function exportCsv() {
    const cols: { k: keyof Registration; h: string }[] = [
      { k: "full_name", h: "Name" },
      { k: "role", h: "Role" },
      { k: "email", h: "Email" },
      { k: "phone", h: "Phone" },
      { k: "country", h: "Country" },
      { k: "occupation", h: "Occupation" },
      { k: "participating_as", h: "Participating As" },
      { k: "team_name", h: "Team Name" },
      { k: "primary_interest", h: "Primary Interest" },
      { k: "experience_level", h: "Experience" },
      { k: "organization", h: "Organization" },
      { k: "partner_org", h: "Partner Org" },
      { k: "linkedin_url", h: "LinkedIn" },
      { k: "website_url", h: "Website" },
      { k: "heard_about", h: "Heard About" },
      { k: "referred_by", h: "Referred By" },
      { k: "created_at", h: "Registered At" },
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      cols.map((c) => c.h).join(","),
      ...sorted.map((r) => cols.map((c) => esc(r[c.k])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${sorted.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-cond text-sm font-bold uppercase tracking-wider text-bone">
            Registrations
          </span>
          <span className="pill-crimson">
            {q || roleFilter !== "all"
              ? `${filtered.length} / ${registrations.length}`
              : registrations.length}
          </span>
          <div className="ml-2 flex gap-1">
            {(
              [
                ["all", `All`],
                ["participant", `Innovators (${registrations.length - mentorCount})`],
                ["mentor", `Coaches (${mentorCount})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRoleFilter(k)}
                className={
                  roleFilter === k
                    ? "pill-crimson"
                    : "pill hover:border-crimson hover:text-crimson"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, country, org…"
            className="field-input w-full sm:w-72"
          />
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="btn shrink-0 disabled:opacity-40"
          >
            ⬇ CSV
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card text-center text-dust">
          {q || roleFilter !== "all"
            ? "No registrations match your filters."
            : "No registrations yet."}
        </div>
      ) : (
        <>
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-line bg-ink-4/50 text-left text-[0.62rem] font-bold uppercase tracking-[0.14em] text-dust">
                  <th className="w-8 py-3 pl-4" aria-hidden />
                  <SortableTh
                    label="Name"
                    sortKey="full_name"
                    sort={sort}
                    onSort={toggleSort}
                    className="pr-3"
                  />
                  <SortableTh
                    label="Type"
                    sortKey="role"
                    sort={sort}
                    onSort={toggleSort}
                    className="pr-3"
                  />
                  <SortableTh
                    label="Country"
                    sortKey="country"
                    sort={sort}
                    onSort={toggleSort}
                    className="hidden pr-3 md:table-cell"
                  />
                  <SortableTh
                    label="Interest / Track"
                    sortKey="primary_interest"
                    sort={sort}
                    onSort={toggleSort}
                    className="hidden pr-3 lg:table-cell"
                  />
                  <SortableTh
                    label="Registered"
                    sortKey="created_at"
                    sort={sort}
                    onSort={toggleSort}
                    className="pr-4 text-right"
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const open = openId === r.id;
                  const isMentor = r.role === "mentor";
                  const zebra = i % 2 === 1;
                  const registered = new Date(r.created_at).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  );
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setOpenId(open ? null : r.id)}
                        aria-expanded={open}
                        className={`cursor-pointer border-b border-line/70 transition ${
                          open
                            ? "bg-blue-600/15"
                            : `${zebra ? "bg-ink-4/40" : ""} hover:bg-blue-600/[0.06]`
                        }`}
                      >
                        <td
                          className={`py-3 pl-4 ${
                            open
                              ? "border-l-4 border-l-blue-600"
                              : "border-l-4 border-l-transparent"
                          }`}
                        >
                          <span
                            className={`inline-block text-[0.7rem] transition-transform ${
                              open ? "rotate-90 text-blue-600" : "text-dust"
                            }`}
                          >
                            ▶
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-bone">
                            {r.full_name}
                          </div>
                          <div className="max-w-[220px] truncate text-xs text-dust">
                            {r.email}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <RoleBadge
                            isMentor={isMentor}
                            participatingAs={r.participating_as}
                          />
                        </td>
                        <td className="hidden py-3 pr-3 text-bone/90 md:table-cell">
                          {r.country || "—"}
                        </td>
                        <td className="hidden max-w-[240px] truncate py-3 pr-3 text-bone/90 lg:table-cell">
                          {r.primary_interest || "—"}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-right text-xs text-dust">
                          {registered}
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td
                            colSpan={6}
                            className="border-b border-line border-l-4 border-l-blue-600 bg-blue-600/[0.06] p-0"
                          >
                            <RegistrationDetail
                              r={r}
                              readOnly={readOnly}
                              onDeleted={() => setOpenId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-dust">
              Showing{" "}
              <span className="font-semibold text-bone">
                {(safePage - 1) * REG_PAGE_SIZE + 1}–
                {Math.min(safePage * REG_PAGE_SIZE, sorted.length)}
              </span>{" "}
              of {sorted.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setOpenId(null);
                  setPage(safePage - 1);
                }}
                disabled={safePage <= 1}
                className="btn h-9 px-4 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="font-cond text-sm font-semibold uppercase tracking-wider text-dust">
                Page {safePage} / {totalPages}
              </span>
              <button
                onClick={() => {
                  setOpenId(null);
                  setPage(safePage + 1);
                }}
                disabled={safePage >= totalPages}
                className="btn h-9 px-4 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}

// Shared by the Registrations table and the judge/mentor roster.
function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
  align = "left",
}: {
  label: string;
  sortKey: K;
  sort: { key: K; dir: "asc" | "desc" };
  onSort: (k: K) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return (
    <th
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={`py-3 ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex cursor-pointer select-none items-center gap-1 tracking-[0.14em] transition hover:text-crimson ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {label}
        <span className={active ? "text-crimson" : "text-dust/40"}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function RoleBadge({
  isMentor,
  participatingAs,
}: {
  isMentor: boolean;
  participatingAs: string | null;
}) {
  if (isMentor) {
    return (
      <span className="inline-flex items-center rounded-full border border-crimson/50 bg-crimson/15 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-crimson">
        Coach
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center rounded-full border border-blue-600/50 bg-blue-600/15 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-blue-700">
        Innovator
      </span>
      {participatingAs && (
        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-dust">
          {participatingAs}
        </span>
      )}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <div className="mb-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-dust">
        {label}
      </div>
      <div className="break-words text-sm text-bone">{value}</div>
    </div>
  );
}

function RegistrationDetail({
  r,
  readOnly,
  onDeleted,
}: {
  r: Registration;
  readOnly: boolean;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startDelete(async () => {
      const res = await deleteRegistration(r.id);
      if (res.ok) {
        onDeleted();
      } else {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  const isMentor = r.role === "mentor";
  const partners = (r.partner_org ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const registered = new Date(r.created_at).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const tel = r.phone ? r.phone.replace(/[^\d+]/g, "") : "";

  return (
    <div className="animate-fade-up p-5">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail
          label="Email"
          value={
            <a
              href={`mailto:${r.email}`}
              className="break-all text-crimson hover:underline"
            >
              {r.email}
            </a>
          }
        />
        {r.phone && (
          <Detail
            label="Phone"
            value={
              <a href={`tel:${tel}`} className="text-crimson hover:underline">
                {r.phone}
              </a>
            }
          />
        )}
        <Detail label="Country" value={r.country} />
        <Detail
          label={isMentor ? "Mentoring track" : "Primary interest"}
          value={r.primary_interest}
        />
        <Detail label="Experience" value={r.experience_level} />
        <Detail label="Occupation" value={r.occupation} />
        <Detail label="Organization" value={r.organization} />
        {partners.length > 0 && (
          <Detail
            label="Partner orgs"
            value={
              <div className="flex flex-wrap gap-1.5">
                {partners.map((p) => (
                  <span key={p} className="pill-crimson">
                    {p}
                  </span>
                ))}
              </div>
            }
          />
        )}
        {r.linkedin_url && (
          <Detail
            label="LinkedIn"
            value={
              <a
                href={safeHref(r.linkedin_url) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-crimson hover:underline"
              >
                {r.linkedin_url}
              </a>
            }
          />
        )}
        {r.website_url && (
          <Detail
            label="Website"
            value={
              <a
                href={safeHref(r.website_url) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-crimson hover:underline"
              >
                {r.website_url}
              </a>
            }
          />
        )}
        <Detail label="Heard via" value={r.heard_about} />
        <Detail label="Referred by" value={r.referred_by} />
        <Detail label="Registered" value={registered} />
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {confirming ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-blood">
              Delete this registration permanently?
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="btn"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <a href={`mailto:${r.email}`} className="btn">
              ✉ Email
            </a>
            {!readOnly && (
              <button onClick={() => setConfirming(true)} className="btn-danger">
                🗑 Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SubmissionsPanel({
  phase,
  submissions,
  progress,
  readOnly,
}: {
  phase: Phase;
  submissions: Submission[];
  progress: Progress[];
  readOnly: boolean;
}) {
  return (
    <div className="card">
      <div className="field-label mb-3">Submissions ({submissions.length})</div>
      <SubmissionsTable
        submissions={submissions}
        progress={progress}
        readOnly={readOnly}
        showScores={phase !== "submissions"}
      />
    </div>
  );
}

// Shared by Admin Home and the Submissions tab. A row opens the full
// submission in a modal; Hide/Show stays one click away on the row.
function SubmissionsTable({
  submissions,
  progress,
  readOnly,
  showScores,
}: {
  submissions: Submission[];
  progress: Progress[];
  readOnly: boolean;
  showScores: boolean;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const votes = new Map(progress.map((p) => [p.submission_id, p.votes]));
  const open = submissions.find((s) => s.id === openId) ?? null;

  async function onToggleHide(id: string, hidden: boolean) {
    setErr(null);
    const r = await toggleHideSubmission(id, hidden);
    if (!r.ok) setErr(r.error);
  }

  const cols = 7 + (showScores ? 1 : 0) + (readOnly ? 0 : 1);

  return (
    <div className="space-y-3">
      {err && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {err}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[0.7rem] uppercase tracking-wider text-crimson">
            <tr>
              <th className="p-2 text-left">Project</th>
              <th className="p-2 text-left">Team</th>
              <th className="hidden p-2 text-left md:table-cell">Track</th>
              <th className="hidden p-2 text-left sm:table-cell">Submitted</th>
              {showScores && <th className="p-2 text-center">Scores</th>}
              <th className="p-2 text-center">Complete</th>
              <th className="p-2 text-center">Review</th>
              <th className="p-2 text-center">Hidden</th>
              {!readOnly && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr
                key={s.id}
                onClick={() => setOpenId(s.id)}
                className="cursor-pointer border-t border-line transition hover:bg-blue-600/[0.06]"
              >
                <td className="p-2">
                  <button
                    type="button"
                    className="text-left font-semibold text-bone hover:text-crimson"
                  >
                    {s.project_name}
                  </button>
                  {s.member1_name && (
                    <div className="text-xs text-dust">{s.member1_name}</div>
                  )}
                </td>
                <td className="p-2 text-dust">{s.team_name || s.solo_or_team || "–"}</td>
                <td className="hidden p-2 text-dust md:table-cell">{s.challenge_track || "–"}</td>
                <td className="hidden whitespace-nowrap p-2 text-xs text-dust sm:table-cell">
                  {new Date(s.created_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                {showScores && (
                  <td className="p-2 text-center font-display text-lg text-bone">
                    {votes.get(s.id) ?? 0}
                  </td>
                )}
                <td className="p-2 text-center">{s.is_submission_complete ? "✓" : "–"}</td>
                <td className="p-2 text-center">{s.needs_review ? "⚠" : ""}</td>
                <td className="p-2 text-center">{s.hidden_from_judges ? "🚫" : ""}</td>
                {!readOnly && (
                  <td className="p-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHide(s.id, !s.hidden_from_judges);
                      }}
                      className="pill hover:border-crimson hover:text-crimson"
                    >
                      {s.hidden_from_judges ? "Show" : "Hide"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={cols} className="p-6 text-center text-dust">
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {open && (
        <SubmissionModal
          s={open}
          votes={votes.get(open.id) ?? 0}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

// Works only while submissions are open, like the link itself.
function CopyEditLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      title={url}
      onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true))}
    >
      {copied ? "✓ Copied" : "🔗 Copy edit link"}
    </button>
  );
}

function SubmissionModal({
  s,
  votes,
  onClose,
}: {
  s: Submission;
  votes: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const text = (v: string | number | null | undefined) =>
    v == null || v === "" ? null : String(v);
  const link = (url: string | number | null | undefined, label?: string) => {
    const href = safeHref(text(url));
    if (!href) return null;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-crimson hover:underline"
      >
        {label ?? href}
      </a>
    );
  };
  const mail = (v: string | number | null | undefined) =>
    text(v) && (
      <a href={`mailto:${v}`} className="break-all text-crimson hover:underline">
        {v}
      </a>
    );
  const longText = (label: string, v: string | number | null | undefined) =>
    text(v) && (
      <div>
        <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-dust">
          {label}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-bone">{v}</p>
      </div>
    );
  const heading = (t: string) => (
    <div className="mb-3 font-cond text-xs font-bold uppercase tracking-wider text-crimson">
      {t}
    </div>
  );

  const links = [
    ["Demo video", s.demo_video_url],
    ["Pitch video", s.demo_video_short_url],
    ["Pitch deck", s.pitch_deck_url],
    ["One-page summary", s.summary_url],
    ["GitHub", s.github_url],
    ["Live demo", s.live_demo_url],
    ["LinkedIn post", s.linkedin_post_url],
  ] as const;
  const members = ([2, 3, 4, 5] as const).filter((n) => text(s[`member${n}_name`]));
  const where = [s.city, s.state_region, s.country].map(text).filter(Boolean).join(", ");

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#081124]/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="submission-modal-title"
    >
      <div
        className="card mx-auto my-6 w-full max-w-3xl animate-fade-up cursor-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="min-w-0">
            <h2 id="submission-modal-title" className="hex-title text-3xl">
              {s.project_name}
            </h2>
            <div className="mt-1 text-sm text-dust">
              {s.team_name || s.solo_or_team || "–"} · submitted{" "}
              {new Date(s.created_at).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.hidden_from_judges && (
                <span className="pill border-blood/50 text-blood">Hidden from judges</span>
              )}
              {s.needs_review && <span className="pill-crimson">⚠ Needs review</span>}
              {!s.is_submission_complete && <span className="pill">Incomplete</span>}
              <span className="pill">
                {votes} judge score{votes === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="pill shrink-0" aria-label="Close">
            ✕ Close
          </button>
        </div>

        <div className="space-y-6 py-5">
          {text(s.review_note) && (
            <div className="rounded-md border border-crimson/40 bg-crimson/10 px-3 py-2 text-sm text-bone">
              <span className="font-semibold">Review note:</span> {s.review_note}
            </div>
          )}
          {text(s.project_description_summary) && (
            <p className="text-base text-bone">{s.project_description_summary}</p>
          )}

          <section>
            {heading("Deliverables")}
            <div className="flex flex-wrap gap-2">
              {links.map(([label, url]) => {
                const href = safeHref(text(url));
                return href ? (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pill hover:border-crimson hover:text-crimson"
                  >
                    {label} ↗
                  </a>
                ) : (
                  <span key={label} className="pill opacity-40">
                    No {label.toLowerCase()}
                  </span>
                );
              })}
            </div>
            {text(s.all_members_in_video) && (
              <p className="mt-2 text-xs text-dust">
                Confirmed all members appear in the video.
              </p>
            )}
          </section>

          <section>
            {heading("Project")}
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Problem brief" value={text(s.problem_brief)} />
              <Detail label="Track" value={text(s.challenge_track)} />
              <Detail label="Category" value={text(s.project_category)} />
              <Detail label="Focus area" value={text(s.focus_area)} />
              <Detail label="Impact focus" value={text(s.impact_focus)} />
              <Detail label="Solution stage" value={text(s.solution_stage)} />
              <Detail label="Who it's for" value={text(s.customer_type)} />
              <Detail label="Region" value={text(s.region)} />
              <Detail label="Target region" value={text(s.target_region)} />
              <Detail label="Area of specification" value={text(s.area_of_specification)} />
              <Detail label="Applies AI" value={text(s.applies_ai)} />
              <Detail label="Technologies" value={text(s.technologies_used)} />
            </div>
          </section>

          {longText("Core problem", s.core_problem)}
          {longText("Problem statement", s.problem_statement)}
          {longText("Description", s.project_description)}
          {longText("Disclosure: before vs. during the event", s.disclosure_statement)}

          <section>
            {heading(`Team${text(s.team_size) ? ` · ${s.team_size}` : ""}`)}
            <div className="space-y-3">
              <div className="rounded-md border border-line bg-ink-4/40 p-3">
                <div className="field-label mb-2">
                  {text(s.member1_name) ?? "Submitter"}{" "}
                  <span className="text-dust">(submitter)</span>
                </div>
                <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Detail label="Email" value={mail(s.member1_email)} />
                  <Detail label="Phone" value={text(s.phone)} />
                  <Detail label="Location" value={where || null} />
                  <Detail label="Organization" value={text(s.affiliated_org)} />
                  <Detail label="Role" value={text(s.submitter_role)} />
                  <Detail label="LinkedIn" value={link(s.submitter_linkedin_url)} />
                </div>
              </div>
              {members.map((n) => (
                <div key={n} className="rounded-md border border-line bg-ink-4/40 p-3">
                  <div className="field-label mb-2">{s[`member${n}_name`]}</div>
                  <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Email" value={mail(s[`member${n}_email`])} />
                    <Detail label="Occupation" value={text(s[`member${n}_occupation`])} />
                    <Detail label="Country" value={text(s[`member${n}_country`])} />
                    <Detail label="LinkedIn" value={link(s[`member${n}_linkedin_url`])} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            {heading("Mentor")}
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Name" value={text(s.mentor_name) ?? "—"} />
              <Detail label="LinkedIn" value={link(s.mentor_linkedin_url)} />
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Link href={`/judge/${s.id}`} target="_blank" className="btn">
            Open judge view ↗
          </Link>
          {text(s.member1_email) && (
            <a href={`mailto:${s.member1_email}`} className="btn">
              ✉ Email submitter
            </a>
          )}
          {s.edit_url && <CopyEditLink url={s.edit_url} />}
          <button onClick={onClose} className="btn ml-auto">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({
  phase,
  submissions,
  lock,
  readOnly,
}: {
  phase: Phase;
  submissions: Submission[];
  lock: Lock | null;
  readOnly: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const byId = new Map(submissions.map((s) => [s.id, s]));

  async function compute(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await computeAndLockTop6(fd);
      if (!r.ok) setErr(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
      <form action={compute} className="card space-y-3">
        <div className="pill-crimson">Compute Top 6</div>
        <p className="text-sm text-dust">
          Runs the Monte Carlo algorithm (1000 trials) on all current scores,
          selects auto-locks (&gt;70% top-6 probability) and fills the rest via
          weighted random draw from the bubble. Saves the result and flips the
          app to <span className="text-crimson">results</span> phase.
        </p>
        <div>
          <label className="field-label">
            Seed (optional — leave blank for random, or use a specific number to
            reproduce a result)
          </label>
          <input
            name="seed"
            type="number"
            placeholder="Random"
            className="field-input mt-1 w-48"
            defaultValue={lock?.seed ?? ""}
          />
        </div>
        <button className="btn-crimson" disabled={pending}>
          {pending ? "Running 1000 trials…" : "🎲 Compute + Lock"}
        </button>
        {err && (
          <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
            {err}
          </div>
        )}
      </form>
      )}

      {readOnly && !lock && (
        <div className="card text-center text-dust">
          The top 6 hasn&apos;t been locked yet.
        </div>
      )}

      {lock && (
        <div className="card">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="pill-crimson">Locked Top 6</div>
              <div className="mt-1 text-[0.7rem] text-dust">
                Seed: <span className="font-mono text-bone">{lock.seed}</span> ·
                Locked: {new Date(lock.locked_at).toLocaleString()}
              </div>
            </div>
            {phase === "results" && (
              <Link href="/results" className="btn">Public Results →</Link>
            )}
          </div>
          <ol className="mt-4 space-y-2">
            {lock.top6.map((t) => {
              const s = byId.get(t.submission_id);
              return (
                <li
                  key={t.submission_id}
                  className="flex items-center justify-between rounded-md border border-line bg-ink-4 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-3xl text-crimson">{t.rank}</span>
                    <span className="font-semibold">{s?.project_name ?? t.submission_id}</span>
                  </div>
                  <span className="pill">
                    P(top6) = {(t.probability * 100).toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Team (admin accounts) — owners only ──────────────────────────
function TeamPanel({
  team,
  loadError,
  session,
}: {
  team: TeamMember[];
  loadError: string | null;
  session: Session;
}) {
  const [addState, setAddState] = useState<
    | { ok: true; email: string; password: string; generated: boolean }
    | { ok: false; error: string }
    | null
  >(null);
  const [addPending, addStart] = useTransition();
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<
    { email: string; password: string } | null
  >(null);
  const [pending, start] = useTransition();

  function onAdd(fd: FormData) {
    setRowErr(null);
    setNewPassword(null);
    addStart(async () => {
      const r = await addAdminUser(null, fd);
      setAddState(r);
      if (r.ok) (document.getElementById("team-form") as HTMLFormElement)?.reset();
    });
  }

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setRowErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setRowErr(r.error);
    });
  }

  function onResetPassword(member: TeamMember) {
    setRowErr(null);
    setNewPassword(null);
    setAddState(null);
    start(async () => {
      const r = await resetAdminUserPassword(member.id);
      if (!r.ok) {
        setRowErr(r.error);
        return;
      }
      setNewPassword({ email: member.email, password: r.password });
    });
  }

  if (loadError) {
    return (
      <div className="card space-y-2">
        <div className="pill-crimson">Setup needed</div>
        <p className="text-sm text-bone">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        id="team-form"
        action={onAdd}
        className="card space-y-4 border-l-4 border-l-crimson"
      >
        <div className="flex items-baseline justify-between">
          <div className="pill-crimson">Add Admin Account</div>
          <span className="text-[0.65rem] uppercase tracking-wider text-dust">
            They sign in at /admin with their email
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Name</label>
            <input name="name" required className="field-input mt-1" />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input
              name="email"
              type="email"
              required
              className="field-input mt-1"
            />
          </div>
          <div>
            <label className="field-label">Role</label>
            <select name="role" defaultValue="viewer" className="field-input mt-1">
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">
              Password (optional — blank generates one)
            </label>
            <input
              name="password"
              type="text"
              autoComplete="off"
              minLength={10}
              className="field-input mt-1"
              placeholder="Leave blank to auto-generate"
            />
          </div>
        </div>

        <ul className="space-y-1 text-[0.7rem] text-dust">
          {ADMIN_ROLES.map((r) => (
            <li key={r}>
              <span className="font-semibold uppercase tracking-wider text-bone">
                {ROLE_LABELS[r]}
              </span>{" "}
              — {ROLE_DESCRIPTIONS[r]}
            </li>
          ))}
        </ul>

        <button className="btn-crimson" disabled={addPending}>
          {addPending ? "Creating…" : "+ Add Account"}
        </button>

        {addState?.ok && (
          <div className="space-y-2 rounded-md border border-jade/60 bg-jade/10 px-3 py-3 text-xs text-jade">
            <div className="font-semibold">
              ✓ Created {addState.email}
              {addState.generated ? " with a generated password:" : "."}
            </div>
            {addState.generated && (
              <div className="select-all rounded border border-jade/40 bg-ink-4 px-3 py-2 font-mono text-sm text-bone">
                {addState.password}
              </div>
            )}
            <div>
              Send it to them now — it isn&apos;t shown again. They can&apos;t
              change it themselves; use Reset password below to issue a new one.
            </div>
          </div>
        )}
        {addState && !addState.ok && (
          <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
            {addState.error}
          </div>
        )}
      </form>

      {newPassword && (
        <div className="card space-y-2 border-l-4 border-l-jade/60">
          <div className="text-xs font-semibold uppercase tracking-wider text-jade">
            New password for {newPassword.email}
          </div>
          <div className="select-all rounded border border-jade/40 bg-ink-4 px-3 py-2 font-mono text-sm text-bone">
            {newPassword.password}
          </div>
          <p className="text-[0.7rem] text-dust">
            Shown once. Their old password stopped working the moment you
            clicked reset.
          </p>
        </div>
      )}

      {rowErr && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {rowErr}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-line bg-ink-4/50 text-left text-[0.62rem] font-bold uppercase tracking-[0.14em] text-dust">
                <th className="py-3 pl-4 pr-3">Account</th>
                <th className="py-3 pr-3">Role</th>
                <th className="py-3 pr-3">Status</th>
                <th className="hidden py-3 pr-3 lg:table-cell">Last sign-in</th>
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => {
                const isSelf = m.id === session.id;
                // Only super admins may change or remove anyone. Everyone else
                // sees the roster read-only — no lock-out by a newly elected
                // admin, and no admin removing another.
                const canEdit = session.isProtected;
                const locked = !canEdit;
                return (
                  <tr key={m.id} className="border-b border-line/70">
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-bone">{m.name}</span>
                        {m.is_protected && (
                          <span
                            title="Super administrator — can only be changed by another super administrator"
                            className="inline-flex items-center rounded-full border border-crimson/50 bg-crimson/15 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-crimson"
                          >
                            ★ Super
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[0.6rem] uppercase tracking-wider text-dust">
                            you
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-dust">{m.email}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={m.role}
                        disabled={isSelf || locked || pending}
                        onChange={(e) =>
                          run(() => setAdminUserRole(m.id, e.target.value))
                        }
                        className="field-input h-9 py-0 text-xs disabled:opacity-50"
                      >
                        {ADMIN_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      {m.is_active ? (
                        <span className="pill-crimson">Active</span>
                      ) : (
                        <span className="pill">Disabled</span>
                      )}
                    </td>
                    <td className="hidden py-3 pr-3 text-xs text-dust lg:table-cell">
                      {m.last_login_at
                        ? new Date(m.last_login_at).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        {locked ? (
                          <span className="text-[0.7rem] text-dust">
                            Super admins only
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => onResetPassword(m)}
                              disabled={pending}
                              className="pill hover:border-crimson hover:text-crimson disabled:opacity-40"
                            >
                              Reset password
                            </button>
                            <button
                              onClick={() =>
                                run(() =>
                                  setAdminUserProtected(m.id, !m.is_protected),
                                )
                              }
                              disabled={pending || (m.role !== "owner" && !m.is_protected)}
                              title={
                                m.role !== "owner" && !m.is_protected
                                  ? "Only owners can be made super administrators"
                                  : undefined
                              }
                              className="pill hover:border-crimson hover:text-crimson disabled:opacity-40"
                            >
                              {m.is_protected ? "Revoke super" : "Make super"}
                            </button>
                            <button
                              onClick={() =>
                                run(() => setAdminUserActive(m.id, !m.is_active))
                              }
                              disabled={isSelf || pending}
                              className="pill hover:border-crimson hover:text-crimson disabled:opacity-40"
                            >
                              {m.is_active ? "Disable" : "Enable"}
                            </button>
                            <DeleteAccountButton
                              disabled={isSelf || pending}
                              onConfirm={() => run(() => removeAdminUser(m.id))}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {team.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-dust">
                    No admin accounts yet. Add one above — until then, /admin is
                    reachable only with the shared password.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[0.7rem] text-dust">
        The shared <span className="font-mono">ADMIN_PASSWORD</span> still works
        as an owner-level break-glass login. Once everyone has their own
        account, rotate it and keep it somewhere safe.
      </p>
    </div>
  );
}

function DeleteAccountButton({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return (
      <button
        onClick={() => setConfirming(true)}
        disabled={disabled}
        className="pill hover:border-blood hover:text-blood disabled:opacity-40"
      >
        Delete
      </button>
    );
  return (
    <span className="flex items-center gap-1">
      <button
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        disabled={disabled}
        className="pill border-blood/60 text-blood disabled:opacity-40"
      >
        Confirm
      </button>
      <button onClick={() => setConfirming(false)} className="pill">
        Cancel
      </button>
    </span>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded border border-line bg-ink-4 px-2 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-dust">{label}</div>
      <div className="font-display text-xl text-bone">{v}</div>
    </div>
  );
}
