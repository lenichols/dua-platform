import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { getViewer } from "@/lib/viewer";
import { getCurrentEvent } from "@/server/event";
import { getResultsLock, rubricAggregates, type RubricAggregate } from "@/server/judging";
import { SCALE_MAX } from "@/lib/rubric";
import { canSeeResults } from "@/server/policy";

export const dynamic = "force-dynamic";

type Agg = RubricAggregate;

export default async function ResultsPage() {
  const event = await getCurrentEvent();
  const phase = event.phase;
  const viewer = await getViewer();
  const isJudge = viewer.kind === "judge";
  const adminSignedIn = viewer.kind === "admin";

  // Gate: only judges and admin can see results
  if (!isJudge && !adminSignedIn) {
    return (
      <>
        <HeaderBar
          rightSlot={
            <Link href="/" className="pill hover:border-crimson hover:text-crimson">
              ← Home
            </Link>
          }
        />
        <PageShell maxWidth="max-w-lg">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Results" }]} />
          <SectionTitle
            eyebrow="Restricted"
            title="Judges Only"
            subtitle="Results are only visible to judges, mentors, and event organizers."
          />
          <div className="flex gap-3">
            <Link href="/judge" className="btn-crimson">Judge Sign In →</Link>
            <Link href="/admin" className="btn">Admin</Link>
          </div>
        </PageShell>
      </>
    );
  }

  // Judges and mentors wait for the results phase; admins can preview.
  if (!canSeeResults(viewer, phase)) {
    return (
      <>
        <HeaderBar
          rightSlot={
            <Link href="/" className="pill hover:border-crimson hover:text-crimson">
              ← Home
            </Link>
          }
        />
        <PageShell maxWidth="max-w-xl">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Judge", href: "/judge" },
              { label: "Results" },
            ]}
          />
          <SectionTitle
            eyebrow={`Phase: ${phase}`}
            title="Results Locked"
            subtitle="Results will be revealed once the admin closes voting."
          />
        </PageShell>
      </>
    );
  }

  const [agg, lock] = await Promise.all([
    rubricAggregates(event, viewer),
    getResultsLock(event, viewer),
  ]);

  const rows = (agg as Agg[]).filter((r) => r.n_judges > 0);
  const { rubric, topN } = event.settings;
  const criteria = rubric.criteria;
  // Level totals are ordered by the rubric's tie-breakers, in turn.
  rows.sort((a, b) => {
    const byTotal = (b.avg_total ?? 0) - (a.avg_total ?? 0);
    if (byTotal) return byTotal;
    for (const key of rubric.tieBreakers) {
      const d = (b.averages[key] ?? 0) - (a.averages[key] ?? 0);
      if (d) return d;
    }
    return 0;
  });

  const top6 = lock?.top6 ?? [];
  const byId = new Map(rows.map((r) => [r.submission_id, r]));

  const crumbs = adminSignedIn && !isJudge
    ? [
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Results" },
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Judge", href: "/judge/dashboard" },
        { label: "Results" },
      ];

  return (
    <>
      <HeaderBar
        rightSlot={
          <Link href="/" className="pill hover:border-crimson hover:text-crimson">
            ← Home
          </Link>
        }
      />
      <PageShell>
        <Breadcrumbs items={crumbs} />

        <SectionTitle
          eyebrow="Phase 3 · Results"
          title={`The Top ${topN}`}
          subtitle="Aggregated breakdown across all judges: totals out of 100, weighted per the rubric, and each criterion's average out of 5. Individual scores stay private — these are the panel-wide averages. Click any card to review the submission and the judges' notes before picking 1st–3rd."
        />

        {top6.length > 0 && (
          <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {top6
              .sort((a, b) => a.rank - b.rank)
              .map((t) => {
                const r = byId.get(t.submission_id);
                if (!r) return null;
                const rankColor =
                  t.rank === 1
                    ? "border-crimson shadow-crimson"
                    : t.rank === 2
                      ? "border-bone/40"
                      : t.rank === 3
                        ? "border-crimson-dark/60"
                        : "border-line";
                return (
                  <Link
                    key={t.submission_id}
                    href={`/judge/${t.submission_id}`}
                    className={`card group relative block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-crimson ${rankColor}`}
                  >
                    <div className="absolute -right-3 -top-3 font-display text-8xl leading-none text-crimson/10">
                      {t.rank}
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="pill-crimson">Rank #{t.rank}</span>
                      <span className="text-[0.65rem] uppercase tracking-wider text-dust transition group-hover:text-crimson">
                        Review →
                      </span>
                    </div>
                    <h3 className="hex-title text-3xl">{r.project_name}</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Total" value={r.avg_total} max={100} />
                      <Stat label="Judges" value={r.n_judges} plain />
                      {criteria.map((c) => (
                        <Stat key={c.key} label={c.label} value={r.averages[c.key]} max={SCALE_MAX} />
                      ))}
                    </div>
                    <div className="mt-3 text-[0.68rem] text-dust">
                      Chance of placing: {(t.probability * 100).toFixed(0)}%
                    </div>
                  </Link>
                );
              })}
          </div>
        )}

        <h2 className="hex-title mb-4 text-2xl">Full Leaderboard</h2>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-ink-4 text-[0.7rem] uppercase tracking-wider text-crimson">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Project</th>
                <th className="p-3 text-right">Total/100</th>
                {criteria.map((c) => {
                  const tie = rubric.tieBreakers.indexOf(c.key);
                  return (
                    <th
                      key={c.key}
                      className="p-3 text-right"
                      title={`${c.label} · ${c.weight}%${tie >= 0 ? ` · tie-breaker ${tie + 1}` : ""}`}
                    >
                      {c.label}
                    </th>
                  );
                })}
                <th className="p-3 text-right">Judges</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.submission_id}
                  className="cursor-pointer border-t border-line transition hover:bg-ink-4"
                >
                  <td className="p-3 font-display text-lg text-crimson">
                    <Link href={`/judge/${r.submission_id}`} className="block">
                      {i + 1}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/judge/${r.submission_id}`}
                      className="block transition hover:text-crimson"
                    >
                      {r.project_name}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-display text-xl">{num(r.avg_total)}</td>
                  {criteria.map((c) => (
                    <td key={c.key} className="p-3 text-right">
                      {num(r.averages[c.key])}
                    </td>
                  ))}
                  <td className="p-3 text-right text-dust">{r.n_judges}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageShell>
    </>
  );
}

function num(v: number | null | undefined) {
  if (v === null || v === undefined) return "–";
  return Number(v).toFixed(1);
}

function Stat({
  label,
  value,
  max,
  plain,
}: {
  label: string;
  value: number | null | undefined;
  max?: number;
  plain?: boolean;
}) {
  return (
    <div className="rounded border border-line bg-ink-4 px-2 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-dust">{label}</div>
      <div className="font-display text-base text-bone">
        {num(value ?? null)}
        {!plain && max ? <span className="text-xs text-dust"> /{max}</span> : null}
      </div>
    </div>
  );
}
