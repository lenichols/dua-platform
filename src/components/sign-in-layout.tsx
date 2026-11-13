import type { ReactNode } from "react";

/**
 * The sign-in pages' layout: what you're signing in to on the left, the form
 * on the right. Stacks on a phone.
 */
export function SignInLayout({
  status,
  title,
  intro,
  aside,
  children,
}: {
  /** Where things stand, e.g. "Judging is open". */
  status?: string;
  title: string;
  intro: string;
  /** Context drawn from the event itself, shown under the intro. */
  aside?: ReactNode;
  /** The form. */
  children: ReactNode;
}) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-ink-3 md:grid-cols-[1.15fr_1fr]">
      <div className="border-b border-line bg-accent/[0.06] p-7 md:border-b-0 md:border-r md:p-10">
        {status && <p className="text-sm font-bold text-accent">{status}</p>}
        <h1 className="hex-title mt-1 text-3xl md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-md text-dust">{intro}</p>
        {aside && <div className="mt-8">{aside}</div>}
      </div>
      <div className="p-7 md:p-10">{children}</div>
    </div>
  );
}

/**
 * The rubric as one bar: each criterion takes the share of the width that it
 * takes of the score.
 */
export function RubricBar({
  criteria,
  topN,
}: {
  criteria: { key: string; label: string; weight: number }[];
  topN: number;
}) {
  // Alternate two tints so neighbouring segments stay distinct.
  const tint = (i: number) => (i % 2 === 0 ? "bg-accent" : "bg-accent/55");
  return (
    <div data-rubric-bar>
      <p className="text-sm font-bold text-bone">How projects are scored</p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden>
        {criteria.map((c, i) => (
          <div key={c.key} className={tint(i)} style={{ width: `${c.weight}%` }} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
        {criteria.map((c, i) => (
          <div key={c.key} className="contents">
            <dt className="flex items-center gap-2 text-bone">
              <span className={`h-2.5 w-2.5 rounded-full ${tint(i)}`} aria-hidden />
              {c.label}
            </dt>
            <dd className="text-right tabular-nums text-dust">{c.weight}%</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-dust">
        Each one gets a score from 1 to 5 and a sentence of evidence. The top {topN} are ranked.
      </p>
    </div>
  );
}

/** The event's three phases in a row, with the current one marked. */
export function PhaseTrack({
  phase,
  facts,
}: {
  phase: "submissions" | "judging" | "results";
  facts: { label: string; value: string }[];
}) {
  const phases = ["submissions", "judging", "results"] as const;
  const at = phases.indexOf(phase);
  return (
    <div data-phase-track>
      <p className="text-sm font-bold text-bone">Where the event stands</p>
      <ol className="mt-3 grid grid-cols-3 gap-2">
        {phases.map((p, i) => (
          <li key={p}>
            <div className={`h-1.5 rounded-full ${i <= at ? "bg-accent" : "bg-line"}`} />
            <div
              className={`mt-2 text-sm capitalize ${i === at ? "font-bold text-bone" : "text-dust"}`}
              aria-current={i === at ? "step" : undefined}
            >
              {p}
            </div>
          </li>
        ))}
      </ol>
      <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-dust">{f.label}</dt>
            <dd className="text-right font-bold text-bone">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
