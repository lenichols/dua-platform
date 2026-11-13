import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs, HeaderBar, PageShell } from "@/components/shell";
import { getPhase } from "@/lib/phase";
import { isAdminSignedIn } from "@/app/admin/auth";
import { getJudgeByAuthUser } from "@/lib/judge-lookup";
import { RUBRIC, evidenceKey } from "@/lib/rubric";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeHref } from "@/lib/url";
import { ConflictCard } from "./conflict-card";
import { ScoreForm, type ExistingScore } from "./score-form";

export const dynamic = "force-dynamic";

// The scores and evidence for the current rubric (0020).
const SCORE_COLUMNS = RUBRIC.flatMap((c) => [c.key, evidenceKey(c.key)]).join(", ");

export default async function JudgeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const phase = await getPhase();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Determine viewer: judge, mentor, admin, or kick out
  const judgeRow = user ? await getJudgeByAuthUser(supabase, user.id) : null;
  const judge = judgeRow?.is_active ? judgeRow : null;
  const isMentor = judge?.role === "mentor";
  const isJudge = !!judge && !isMentor;
  const adminOnly = !judge && (await isAdminSignedIn());
  if (!judge && !adminOnly) redirect("/judge");
  if (judge && phase === "submissions") redirect("/judge/dashboard");

  // Admins use the service role to fetch all submission data; judges use the
  // sanitized public view (no member emails).
  let sub: Record<string, string | number | null> | null = null;
  if (judge) {
    const { data } = await supabase
      .from("submissions_public")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    sub = data ?? null;
  } else {
    const admin = createAdminClient();
    const { data } = await admin
      .from("submissions")
      .select(
        "id, project_name, team_name, solo_or_team, challenge_track, project_category, project_description, project_description_summary, technologies_used, team_size, github_url, live_demo_url, demo_video_url, linkedin_post_url, member1_name, member2_name, member3_name, member4_name, member5_name, energy_sector, impact_focus, target_region, solution_stage, country, customer_type, region, area_of_specification, problem_statement, core_energy_problem, applies_ai, mentor_name, demo_video_short_url, pitch_deck_url, summary_url, disclosure_statement, problem_brief",
      )
      .eq("id", id)
      .maybeSingle();
    sub = data ?? null;
  }
  if (!sub) notFound();

  const existing = isJudge
    ? ((
        await supabase
          .from("scores")
          .select(SCORE_COLUMNS)
          .eq("judge_id", judge!.id)
          .eq("submission_id", id)
          .maybeSingle()
      ).data as unknown as ExistingScore | null)
    : null;

  // Judges read their own recusals (RLS); mentors and admins don't recuse.
  const recusal = isJudge
    ? (
        await supabase
          .from("recusals")
          .select("reason")
          .eq("judge_id", judge!.id)
          .eq("submission_id", id)
          .maybeSingle()
      ).data
    : null;

  // In results phase (or for admins viewing), fetch every judge's evidence
  // sentences for this submission. Shown anonymously as "Judge A/B/C…" and
  // without the scores, to keep the "aggregates only" rule.
  let judgeNotes: { label: string; lines: { criterion: string; text: string }[] }[] =
    [];
  if (phase === "results" || adminOnly) {
    const admin = createAdminClient();
    const { data: notes } = await admin
      .from("scores")
      .select(SCORE_COLUMNS)
      .eq("submission_id", id)
      .not("sustainability", "is", null)
      .order("created_at", { ascending: true });
    judgeNotes = ((notes ?? []) as unknown as Record<string, string | null>[]).map(
      (n, i) => ({
        label: `Judge ${String.fromCharCode(65 + i)}`,
        lines: RUBRIC.map((c) => ({
          criterion: c.label,
          text: (n[evidenceKey(c.key)] ?? "").trim(),
        })).filter((l) => l.text.length > 0),
      }),
    );
  }

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
            className="pill hover:border-crimson hover:text-crimson"
          >
            ← Back
          </Link>
        }
      />
      <PageShell>
        <Breadcrumbs items={crumbs} />

        <div className="mb-6 animate-fade-up">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {sub.solo_or_team && <span className="pill">{sub.solo_or_team}</span>}
            {sub.team_name && <span className="pill">{sub.team_name}</span>}
            {sub.challenge_track && (
              <span className="pill">{sub.challenge_track}</span>
            )}
            {sub.project_category &&
              sub.project_category !== sub.challenge_track && (
                <span className="pill">{sub.project_category}</span>
              )}
            {sub.energy_sector && (
              <span className="pill-crimson">⚡ {sub.energy_sector}</span>
            )}
            {sub.solution_stage && (
              <span className="pill">{sub.solution_stage}</span>
            )}
            {sub.customer_type && <span className="pill">{sub.customer_type}</span>}
            {sub.area_of_specification && (
              <span className="pill">{sub.area_of_specification}</span>
            )}
            {sub.applies_ai === "Yes" && (
              <span className="pill-crimson">🤖 Uses AI</span>
            )}
          </div>
          {sub.problem_brief && (
            <div className="mb-2 text-sm">
              <span className="field-label">Problem brief · </span>
              <span className="font-semibold text-bone">{sub.problem_brief}</span>
            </div>
          )}
          <h1 className="hex-title text-5xl">{sub.project_name}</h1>
          {sub.project_description_summary && (
            <p className="mt-3 text-dust">{sub.project_description_summary}</p>
          )}
          <div className="mt-4 h-[2px] w-28 rounded bg-gradient-to-r from-crimson via-bone/80 to-crimson opacity-70" />
        </div>

        {/* Judge guidance — only shown during judging phase */}
        {isJudge && phase === "judging" && (
          <div className="card mb-6 border-l-4 border-l-crimson">
            <div className="mb-2 flex items-center gap-2">
              <span className="pill-crimson">How to Score</span>
              <span className="text-[0.7rem] uppercase tracking-wider text-dust">
                Read this before scoring
              </span>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-bone/90">
              <li>
                <strong className="text-crimson">Read the team&apos;s brief first</strong>
                . Its success metrics define what a 5 looks like.
              </li>
              <li>
                <strong className="text-crimson">
                  Watch the demo video, then the pitch video.
                </strong>{" "}
                The demo video is the source of truth for what was actually
                built.
              </li>
              <li>
                <strong className="text-crimson">
                  Read the one-page summary and description.
                </strong>{" "}
                Gaps between promise and delivery weigh on Feasibility and
                Impact.
              </li>
              <li>
                <strong className="text-crimson">Check the disclosure.</strong>{" "}
                Score what was built during the sprint. Flag undisclosed prior
                work to the organizers rather than marking it down.
              </li>
              <li>
                <strong className="text-crimson">
                  Open the build files and pitch deck.
                </strong>{" "}
                Look for signs of real work: commits during the sprint,
                calculations that add up, a cost model that exists.
              </li>
              <li>
                <strong className="text-crimson">
                  Score all five criteria 1–5 and write one sentence of evidence
                  for each
                </strong>{" "}
                — what the team showed, not what they claimed.
              </li>
            </ol>
            <p className="mt-3 text-[0.7rem] text-dust">
              Whole numbers only; use 2 and 4 when a team falls between levels.
              You can update a score any time until voting closes. If the video
              won&apos;t play or a link is broken, don&apos;t score it — tell the
              organizers.
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
            {sub.core_energy_problem && (
              <div>
                <div className="field-label">Core Energy Problem</div>
                <p className="mt-1 text-sm">{sub.core_energy_problem}</p>
              </div>
            )}
            {sub.technologies_used && (
              <div>
                <div className="field-label">Tech</div>
                <p className="mt-1 text-sm">{sub.technologies_used}</p>
              </div>
            )}
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
                      className="btn-crimson text-xs"
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
                judgeId={judge!.id}
                existing={existing ?? null}
              />
              <ConflictCard submissionId={String(sub.id)} recusal={null} />
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
                      ? "You're viewing this as the admin. Use this view during the results phase to review a top-6 candidate before assigning 1st–3rd place."
                      : phase === "results"
                        ? "Voting is closed. Review the judges' notes below to help decide 1st–3rd."
                        : "Scoring is only available during the judging phase."}
                </p>
              </div>

              {isJudge && phase === "submissions" && (
                <ConflictCard submissionId={String(sub.id)} recusal={null} />
              )}

              {judgeNotes.length > 0 && (
                <div className="card h-fit">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="pill-crimson">✎ Judge Notes</span>
                    <span className="text-[0.65rem] uppercase tracking-wider text-dust">
                      {judgeNotes.length} note{judgeNotes.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {judgeNotes.map((n, idx) => (
                      <li
                        key={idx}
                        className="border-l-2 border-l-crimson/40 bg-ink-4/60 px-3 py-2"
                      >
                        <div className="mb-1 font-cond text-[0.65rem] font-bold uppercase tracking-[0.2em] text-crimson">
                          {n.label}
                        </div>
                        <dl className="space-y-1">
                          {n.lines.map((l) => (
                            <div key={l.criterion} className="text-sm text-bone/90">
                              <dt className="inline font-semibold">{l.criterion}: </dt>
                              <dd className="inline whitespace-pre-wrap">{l.text}</dd>
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
