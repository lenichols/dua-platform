"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveScore } from "../actions";
import { useEvent } from "@/components/event-context";
import { SCALE_MAX, totalScore, type Evidence, type Marks } from "@/lib/rubric";

export type ExistingScore = { marks: Marks; evidence: Evidence };

type Scores = Record<string, number | null>;

// The rubric asks for one sentence per criterion; this just stops a bare "ok".
const MIN_EVIDENCE_LENGTH = 15;

const LEVEL_LABELS: Record<number, string> = {
  1: "Limited",
  3: "Solid",
  5: "Exceptional",
};

export function ScoreForm({
  submissionId,
  existing,
}: {
  submissionId: string;
  existing: ExistingScore | null;
}) {
  const router = useRouter();
  const { rubric, judging } = useEvent();
  const needEvidence = judging.requireEvidence;
  const RUBRIC = rubric.criteria;
  const prior = existing;
  const [scores, setScores] = useState<Scores>(() =>
    Object.fromEntries(RUBRIC.map((c) => [c.key, prior?.marks[c.key] ?? null])),
  );
  const [evidence, setEvidence] = useState<Evidence>(() =>
    Object.fromEntries(RUBRIC.map((c) => [c.key, prior?.evidence[c.key] ?? ""])),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const total = useMemo(() => totalScore(rubric, scores), [rubric, scores]);
  const allScored = RUBRIC.every((c) => scores[c.key] != null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!allScored) {
      setErr("Score every criterion before submitting.");
      return;
    }
    const missing = needEvidence
      ? RUBRIC.filter((c) => (evidence[c.key] ?? "").trim().length < MIN_EVIDENCE_LENGTH)
      : [];
    if (missing.length > 0) {
      setErr(
        `Write one sentence of evidence for ${missing.map((c) => c.label).join(", ")}.`,
      );
      return;
    }
    setSaving(true);
    setErr(null);
    // The server works out who the judge is from the session and re-checks
    // every rule; nothing here is trusted.
    const result = await saveScore(submissionId, { marks: scores, evidence });
    setSaving(false);
    if (!result.ok) {
      setErr(result.error);
      return;
    }
    router.push("/judge/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card h-fit space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="pill-accent">Your Score</div>
        <div className="text-right">
          <div className="font-display text-4xl text-accent">
            {allScored ? Math.round(total) : "–"}{" "}
            <span className="text-base text-dust">/ 100</span>
          </div>
          <div className="text-[0.6rem] text-dust">
            Weighted total
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {RUBRIC.map((c) => {
          const tieRank = rubric.tieBreakers.indexOf(c.key);
          const ek = c.key;
          return (
            <div key={c.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-sm font-bold text-bone">
                  {c.label}
                  <span className="ml-2 text-[0.6rem] text-dust">{c.weight}%</span>
                  {tieRank >= 0 && (
                    <span className="ml-2 text-[0.6rem] text-accent">
                      Tie-breaker {tieRank + 1}
                    </span>
                  )}
                </label>
                <span className="font-display text-xl text-bone">
                  {scores[c.key] ?? "–"}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-5 gap-1" data-criterion={c.key}>
                {Array.from({ length: SCALE_MAX }, (_, i) => i + 1).map((n) => {
                  const on = scores[c.key] === n;
                  return (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                      className={`flex h-11 flex-col items-center justify-center rounded font-semibold transition ${
                        on
                          ? "border border-accent bg-accent/20 text-accent"
                          : "border border-line bg-ink-4 text-dust hover:border-accent/60 hover:text-bone"
                      }`}
                    >
                      <span className="text-sm">{n}</span>
                      {LEVEL_LABELS[n] && (
                        <span className="text-[0.55rem]">
                          {LEVEL_LABELS[n]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <details className="mt-1 text-[0.68rem] text-dust">
                <summary className="cursor-pointer select-none hover:text-bone">
                  Scoring levels
                </summary>
                <dl className="mt-1 space-y-0.5">
                  <div><dt className="inline font-semibold text-bone/80">1 Limited: </dt><dd className="inline">{c.anchors.limited}</dd></div>
                  <div><dt className="inline font-semibold text-bone/80">3 Solid: </dt><dd className="inline">{c.anchors.solid}</dd></div>
                  <div><dt className="inline font-semibold text-bone/80">5 Exceptional: </dt><dd className="inline">{c.anchors.exceptional}</dd></div>
                  <div>2 and 4 sit between the levels.</div>
                </dl>
              </details>
              <label className="sr-only" htmlFor={`evidence-${c.key}`}>
                {c.label} evidence
              </label>
              <textarea
                id={`evidence-${c.key}`}
                rows={2}
                required={needEvidence}
                minLength={needEvidence ? MIN_EVIDENCE_LENGTH : undefined}
                className="field-input mt-1.5 text-xs"
                placeholder={
                  c.example
                    ? `Evidence: ${c.example}`
                    : needEvidence
                      ? "One sentence of evidence"
                      : "Evidence (optional)"
                }
                value={evidence[ek] ?? ""}
                onChange={(e) =>
                  setEvidence((v) => ({ ...v, [ek]: e.target.value }))
                }
              />
            </div>
          );
        })}
      </div>

      <p className="text-[0.68rem] text-dust">
        {needEvidence
          ? "One sentence of evidence per score: what the team showed, not what they claimed."
          : "Evidence is optional: a sentence on what the team showed helps the panel."}{" "}
        Evidence appears on the results page as Judge A, Judge B… and never with your name.
      </p>

      {err && (
        <div className="rounded-md border border-blood/60 bg-blood/10 px-3 py-2 text-xs text-blood">
          {err}
        </div>
      )}

      <button className="btn-accent w-full" disabled={saving}>
        {saving ? "Saving…" : prior ? "↻ Update Score" : "✔ Submit Score"}
      </button>
    </form>
  );
}
