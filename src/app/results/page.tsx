import Link from "next/link";
import { Breadcrumbs, HeaderBar, PageShell, SectionTitle } from "@/components/shell";
import { isAdminSignedIn } from "@/app/admin/auth";
import { getPhase } from "@/lib/phase";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Agg = {
  submission_id: string;
  project_name: string;
  n_judges: number;
  avg_impact: number | null;
  avg_innovation: number | null;
  avg_sustainability: number | null;
  avg_feasibility: number | null;
  avg_scalability: number | null;
  avg_total: number | null;
};

type Lock = {
  top6: { submission_id: string; rank: number; probability: number }[];
};

export default async function ResultsPage() {
  const phase = await getPhase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminSignedIn = await isAdminSignedIn();

  // Is the signed-in user an active judge or mentor? Both see results.
  let isJudge = false;
  if (user) {
    const { data: judge } = await supabase
      .from("judges")
      .select("is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    isJudge = !!judge?.is_active;
  }

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

  // Fetch aggregates. Judges use RPC (RLS-gated to phase=results or admin).
  // Admins use the service role so they can preview before the phase flip.
  const useAdminClient = adminSignedIn && !isJudge;
  const client = useAdminClient ? createAdminClient() : supabase;

  const [{ data: agg }, { data: lock }] = await Promise.all([
    client.rpc("rubric_aggregates"),
    client.from("results_lock").select("top6").eq("id", 1).maybeSingle(),
  ]);

  if (phase !== "results" && !adminSignedIn) {
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

  const rows = ((agg ?? []) as Agg[]).filter((r) => r.n_judges > 0);
  // Ties: higher Impact, then higher Innovation .
  rows.sort(
    (a, b) =>
      (b.avg_total ?? 0) - (a.avg_total ?? 0) ||
      (b.avg_impact ?? 0) - (a.avg_impact ?? 0) ||
      (b.avg_innovation ?? 0) - (a.avg_innovation ?? 0),
  );

  const top6 = (lock?.top6 as Lock["top6"]) ?? [];
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
          title="The Top 6"
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
                      <Stat label="Impact" value={r.avg_impact} max={5} />
                      <Stat label="Innovation" value={r.avg_innovation} max={5} />
                      <Stat label="Sustainability" value={r.avg_sustainability} max={5} />
                      <Stat label="Feasibility" value={r.avg_feasibility} max={5} />
                      <Stat label="Scalability" value={r.avg_scalability} max={5} />
                    </div>
                    <div className="mt-3 text-[0.68rem] text-dust">
                      Top-6 probability: {(t.probability * 100).toFixed(0)}%
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
                <th className="p-3 text-right" title="Impact · 25% · tie-breaker 1">Impact</th>
                <th className="p-3 text-right" title="Innovation · 25% · tie-breaker 2">Innov</th>
                <th className="p-3 text-right" title="Sustainability (incl. affordability) · 25%">Sust</th>
                <th className="p-3 text-right" title="Feasibility · 15%">Feas</th>
                <th className="p-3 text-right" title="Scalability · 10%">Scal</th>
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
                  <td className="p-3 text-right text-crimson">{num(r.avg_impact)}</td>
                  <td className="p-3 text-right">{num(r.avg_innovation)}</td>
                  <td className="p-3 text-right">{num(r.avg_sustainability)}</td>
                  <td className="p-3 text-right">{num(r.avg_feasibility)}</td>
                  <td className="p-3 text-right">{num(r.avg_scalability)}</td>
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
