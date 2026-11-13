import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell } from "@/components/shell";
import { getAdminSession } from "@/app/admin/auth";
import { getCurrentEvent } from "@/server/event";
import {
  getAnswersForViewer,
  getOwnRecusal,
  getOwnScore,
  getSubmissionForViewer,
  listJudgeNotes,
} from "@/server/judging";
import { hiddenQuestions } from "@/lib/event-settings";
import type { Viewer } from "@/server/policy";
import { getJudgeSession } from "../auth";
import { safeHref } from "@/lib/url";
import { ConflictCard } from "./conflict-card";
import { ScoreForm, type ExistingScore } from "./score-form";

export const dynamic = "force-dynamic";

export default async function JudgeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getCurrentEvent();
  const phase = event.phase;

  // Determine viewer: judge, mentor, admin, or kick out
  const judge = await getJudgeSession();
  const isMentor = judge?.role === "mentor";
  const isJudge = !!judge && !isMentor;
  const adminSession = judge ? null : await getAdminSession();
  const adminOnly = !!adminSession;
  if (!judge && !adminSession) redirect("/judge");
  if (judge && phase === "submissions") redirect("/judge/dashboard");

  const viewer: Viewer = judge
    ? { kind: "judge", judgeId: judge.id, role: judge.role }
    : { kind: "admin", role: adminSession!.role };

  // Never includes contact details, whoever is looking. Judges only get
  // submissions that are complete and not hidden.
  const sub = await getSubmissionForViewer(event, viewer, id);
  if (!sub) notFound();

  // A judge's own score and conflict, never anyone else's.
  const existing: ExistingScore | null = await getOwnScore(event, viewer, id);
  const recusal = await getOwnRecusal(event, viewer, id);

  // Once results are open (or for admins), every judge's evidence sentences,
  // shown anonymously as "Judge A/B/C…" and without the scores, to keep the
  // "aggregates only" rule.
  const judgeNotes = await listJudgeNotes(event, viewer, id);
  // What to do before scoring, built from what this event asks teams for, so
  // it never points a judge at something the form doesn't collect.
  const asked = (id: string) =>
    !hiddenQuestions(event.settings, "submission").has(id);
  const { requireEvidence, recusals } = event.settings.judging;
  const videos = [
    asked("demo_video") && "demo video",
    asked("pitch_video") && "pitch video",
  ].filter(Boolean);
  const steps = [
    asked("problem_brief") && {
      lead: "Read the team's brief first.",
      rest: "Its success metrics define what a 5 looks like.",
    },
    videos.length > 0 && {
      lead: `Watch the ${videos.join(", then the ")}.`,
      rest: asked("demo_video")
        ? "The demo video is the source of truth for what was actually built."
        : "It shows what the team says they built.",
    },
    {
      lead: asked("materials")
        ? "Read the one-page summary and description."
        : "Read the description.",
      rest: "Gaps between promise and delivery weigh on the score.",
    },
    asked("materials") && {
      lead: "Check the disclosure.",
      rest: "Score what was built during the event. Flag undisclosed prior work to the organizers rather than marking it down.",
    },
    (asked("code_links") || asked("materials")) && {
      lead:
        asked("code_links") && asked("materials")
          ? "Open the build files and pitch deck."
          : asked("code_links")
            ? "Open the build files."
            : "Open the pitch deck.",
      rest: "Look for signs of real work, not just claims.",
    },
    {
      lead: requireEvidence
        ? "Score every criterion 1–5 and write one sentence of evidence for each"
        : "Score every criterion 1–5",
      rest: requireEvidence
        ? "— what the team showed, not what they claimed."
        : "on what the team showed, not what they claimed.",
    },
  ].filter((x): x is { lead: string; rest: string } => Boolean(x));

  // The organizer's own questions, where they chose to show the answer to judges.
  const answers = await getAnswersForViewer(event, viewer, id);

  const crumbs = judge
    ? [
        { label: "Home", href: "/" },
        { label: "Judge", href: "/judge" },
        { label: "Dashboard", href: "/judge/dashboard" },
        { label: String(sub.project_name ?? "Submission") },
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Results", href: "/results" },
        { label: String(sub.project_name ?? "Submission") },
      ];

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link
            href={judge ? "/judge/dashboard" : "/results"}
            className="pill hover:border-accent hover:text-accent"
          >
            ← Back
          </Link>
        }
      />
      <PageShell>
        <Breadcrumbs items={crumbs} />

        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {sub.solo_or_team && (
              <span className="pill">{sub.solo_or_team}</span>
            )}
            {sub.team_name && <span className="pill">{sub.team_name}</span>}
            {sub.challenge_track && (
              <span className="pill">{sub.challenge_track}</span>
            )}
            {sub.project_category &&
              sub.project_category !== sub.challenge_track && (
                <span className="pill">{sub.project_category}</span>
              )}
            {sub.focus_area && (
              <span className="pill-accent">{sub.focus_area}</span>
            )}
            {sub.solution_stage && (
              <span className="pill">{sub.solution_stage}</span>
            )}
            {sub.customer_type && (
              <span className="pill">{sub.customer_type}</span>
            )}
            {sub.area_of_specification && (
              <span className="pill">{sub.area_of_specification}</span>
            )}
            {sub.applies_ai === "Yes" && (
              <span className="pill-accent">🤖 Uses AI</span>
            )}
          </div>
          {sub.problem_brief && (
            <p className="mb-2 text-sm text-dust">
              Problem brief:{" "}
              <span className="font-bold text-bone">{sub.problem_brief}</span>
            </p>
          )}
          <h1 className="hex-title text-4xl md:text-5xl">{sub.project_name}</h1>
          {sub.project_description_summary && (
            <p className="mt-3 text-dust">{sub.project_description_summary}</p>
          )}
        </div>

        {/* Judge guidance — only shown during judging phase */}
        {isJudge && phase === "judging" && (
          <div className="card mb-6 border-l-4 border-l-accent">
            <div className="mb-2 flex items-center gap-2">
              <span className="pill-accent">How to Score</span>
              <span className="text-[0.7rem] text-dust">
                Read this before scoring
              </span>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-bone/90">
              {steps.map((step) => (
                <li key={step.lead}>
                  <strong className="text-accent">{step.lead}</strong>{" "}
                  {step.rest}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[0.7rem] text-dust">
              Whole numbers only; use 2 and 4 when a team falls between levels.
              You can update a score any time until voting closes. If the video
              won&apos;t play or a link is broken, don&apos;t score it — tell
              the organizers.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="card space-y-4">
            {sub.problem_statement && (
              <div>
                <div className="field-label">Problem Statement</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {sub.problem_statement}
                </p>
              </div>
            )}
            <div>
              <div className="field-label">Description</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {sub.project_description || "—"}
              </p>
            </div>
            {sub.core_problem && (
              <div>
                <div className="field-label">Core Problem</div>
                <p className="mt-1 text-sm">{sub.core_problem}</p>
              </div>
            )}
            {sub.technologies_used && (
              <div>
                <div className="field-label">Tech</div>
                <p className="mt-1 text-sm">{sub.technologies_used}</p>
              </div>
            )}
            {answers.map((a) => (
              <div key={a.key} data-custom-answer={a.key}>
                <div className="field-label">{a.label}</div>
                {a.type === "url" && safeHref(a.value) ? (
                  <a
                    href={safeHref(a.value)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all text-sm text-accent underline"
                  >
                    {a.value}
                  </a>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm">{a.value}</p>
                )}
              </div>
            ))}
            {sub.disclosure_statement && (
              <div className="rounded-md border border-line bg-ink-4/60 px-3 py-2">
                <div className="field-label">
                  Disclosure · prior work, AI tools, open source &amp; data
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {sub.disclosure_statement}
                </p>
              </div>
            )}
            {(sub.impact_focus ||
              sub.target_region ||
              sub.country ||
              sub.region ||
              sub.mentor_name) && (
              <div className="grid gap-3 sm:grid-cols-3">
                {sub.impact_focus && (
                  <div>
                    <div className="field-label">Impact Focus</div>
                    <p className="mt-1 text-sm">{sub.impact_focus}</p>
                  </div>
                )}
                {sub.target_region && (
                  <div>
                    <div className="field-label">Target Region</div>
                    <p className="mt-1 text-sm">{sub.target_region}</p>
                  </div>
                )}
                {sub.country && (
                  <div>
                    <div className="field-label">Country</div>
                    <p className="mt-1 text-sm">{sub.country}</p>
                  </div>
                )}
                {sub.region && (
                  <div>
                    <div className="field-label">Region</div>
                    <p className="mt-1 text-sm">{sub.region}</p>
                  </div>
                )}
                {sub.mentor_name && (
                  <div>
                    <div className="field-label">Mentor</div>
                    <p className="mt-1 text-sm">{sub.mentor_name}</p>
                  </div>
                )}
              </div>
            )}
            {(sub.member1_name || sub.member2_name) && (
              <div>
                <div className="field-label">Team</div>
                <p className="mt-1 text-sm">
                  {[
                    sub.member1_name,
                    sub.member2_name,
                    sub.member3_name,
                    sub.member4_name,
                    sub.member5_name,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
            {(() => {
              const demoHref = safeHref(sub.demo_video_url);
              const shortHref = safeHref(sub.demo_video_short_url);
              const githubHref = safeHref(sub.github_url);
              const liveHref = safeHref(sub.live_demo_url);
              const linkedinHref = safeHref(sub.linkedin_post_url);
              const deckHref = safeHref(sub.pitch_deck_url);
              const summaryHref = safeHref(sub.summary_url);
              return (
                <div className="flex flex-wrap gap-2 pt-2">
                  {demoHref && (
                    <a
                      href={demoHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-accent text-xs"
                    >
                      ▣ Watch Demo Video First
                    </a>
                  )}
                  {shortHref && (
                    <a
                      href={shortHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-xs"
                    >
                      ▣ Pitch Video
                    </a>
                  )}
                  {deckHref && (
                    <a
                      href={deckHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-xs"
                    >
                      ▤ Pitch Deck
                    </a>
                  )}
                  {summaryHref && (
                    <a
                      href={summaryHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-xs"
                    >
                      ▤ One-Page Summary
                    </a>
                  )}
                  {githubHref && (
                    <a
                      href={githubHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-xs"
                    >
                      ⚙ GitHub
                    </a>
                  )}
                  {liveHref && (
                    <a
                      href={liveHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-xs"
                    >
                      ▶ Live Demo
                    </a>
                  )}
                  {linkedinHref && (
                    <a
                      href={linkedinHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-xs"
                    >
                      in Announcement
                    </a>
                  )}
                </div>
              );
            })()}
          </div>

          {isJudge && phase !== "results" && recusal ? (
            <ConflictCard submissionId={String(sub.id)} recusal={recusal} />
          ) : isJudge && phase === "judging" ? (
            <div className="space-y-4">
              <ScoreForm
                submissionId={String(sub.id)}
                existing={existing ?? null}
              />
              {recusals && (
                <ConflictCard submissionId={String(sub.id)} recusal={null} />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card h-fit">
                <div className="pill mb-2">
                  {isMentor
                    ? "Mentor · View Only"
                    : adminOnly
                      ? "Admin View"
                      : "Scoring closed"}
                </div>
                <p className="text-sm text-dust">
                  {isMentor
                    ? "Mentors get full read access to every submission to advise teams and the program — but they don't vote. The top-6 is decided by judges only."
                    : adminOnly
                      ? "You're viewing this as the admin. Use this view during the results phase to review a top-placed candidate before assigning 1st–3rd place."
                      : phase === "results"
                        ? "Voting is closed. Review the judges' notes below to help decide 1st–3rd."
                        : "Scoring is only available during the judging phase."}
                </p>
              </div>

              {isJudge && recusals && phase === "submissions" && (
                <ConflictCard submissionId={String(sub.id)} recusal={null} />
              )}

              {judgeNotes.length > 0 && (
                <div className="card h-fit">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="pill-accent">✎ Judge Notes</span>
                    <span className="text-[0.65rem] text-dust">
                      {judgeNotes.length} note
                      {judgeNotes.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {judgeNotes.map((n, idx) => (
                      <li
                        key={idx}
                        className="border-l-2 border-l-accent/40 bg-ink-4/60 px-3 py-2"
                      >
                        <div className="mb-1 text-[0.65rem] font-bold text-accent">
                          {n.label}
                        </div>
                        <dl className="space-y-1">
                          {n.lines.map((l) => (
                            <div
                              key={l.criterion}
                              className="text-sm text-bone/90"
                            >
                              <dt className="inline font-semibold">
                                {l.criterion}:{" "}
                              </dt>
                              <dd className="inline whitespace-pre-wrap">
                                {l.text}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[0.65rem] italic text-dust">
                    Judge names are anonymized and individual scores stay
                    private — only the evidence sentences are shown here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}
