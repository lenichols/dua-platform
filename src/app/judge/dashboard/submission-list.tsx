"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type SubRow = {
  id: string;
  project_name: string;
  team_name: string | null;
  solo_or_team: string | null;
  challenge_track: string | null;
  project_description_summary: string | null;
};

type Filter = "all" | "pending" | "scored";

export function SubmissionList({
  rows,
  scoredIds,
  recusedIds = [],
  canScore,
  mentorMode = false,
}: {
  rows: SubRow[];
  scoredIds: string[];
  recusedIds?: string[];
  canScore: boolean;
  mentorMode?: boolean;
}) {
  const scored = useMemo(() => new Set(scoredIds), [scoredIds]);
  const recused = useMemo(() => new Set(recusedIds), [recusedIds]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [track, setTrack] = useState<string>("all");

  const tracks = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.challenge_track && set.add(r.challenge_track));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        !mentorMode &&
        filter === "pending" &&
        (scored.has(r.id) || recused.has(r.id))
      )
        return false;
      if (!mentorMode && filter === "scored" && !scored.has(r.id)) return false;
      if (track !== "all" && r.challenge_track !== track) return false;
      if (!needle) return true;
      return (
        r.project_name.toLowerCase().includes(needle) ||
        (r.team_name ?? "").toLowerCase().includes(needle) ||
        (r.project_description_summary ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, scored, recused, q, filter, track, mentorMode]);

  const pendingCount = rows.length - scored.size - recused.size;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="field-label">Search</label>
            <input
              type="search"
              placeholder="Project name, team, summary…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="field-input mt-1"
            />
          </div>
          <div>
            <label className="field-label">Track</label>
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              className="field-input mt-1"
            >
              <option value="all">All tracks</option>
              {tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!mentorMode && (
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", `All (${rows.length})`],
                ["pending", `Pending (${pendingCount})`],
                ["scored", `Scored (${scored.size})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full border px-3 py-1 font-cond text-xs font-semibold uppercase tracking-wider transition ${
                  filter === key
                    ? "border-crimson bg-crimson/15 text-crimson"
                    : "border-line bg-ink-4 text-dust hover:border-crimson/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card text-center text-dust">
          {rows.length === 0
            ? "No submissions are visible yet."
            : "Nothing matches those filters."}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-ink-3">
          {filtered.map((s) => {
            const isDone = scored.has(s.id);
            const isRecused = recused.has(s.id);
            return (
              <li key={s.id}>
                <Link
                  href={`/judge/${s.id}`}
                  className={`group flex items-center gap-3 px-4 py-3 transition hover:bg-ink-4 ${
                    isDone || isRecused ? "opacity-80" : ""
                  }`}
                >
                  {/* Status dot */}
                  <span
                    aria-hidden
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      mentorMode || isRecused
                        ? "bg-dust/40"
                        : isDone
                          ? "bg-jade"
                          : "bg-blood/70"
                    }`}
                  />

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="truncate font-cond text-base font-bold uppercase tracking-wider text-bone group-hover:text-crimson">
                        {s.project_name}
                      </span>
                      {s.solo_or_team && (
                        <span className="text-[0.65rem] uppercase tracking-wider text-dust">
                          {s.solo_or_team}
                          {s.team_name ? ` · ${s.team_name}` : ""}
                        </span>
                      )}
                    </div>
                    {s.project_description_summary && (
                      <p className="line-clamp-1 text-xs text-dust">
                        {s.project_description_summary}
                      </p>
                    )}
                  </div>

                  {/* Track pill */}
                  {s.challenge_track && (
                    <span className="hidden sm:inline-flex pill whitespace-nowrap">
                      {s.challenge_track}
                    </span>
                  )}

                  {/* Status pill */}
                  <span
                    className={`whitespace-nowrap rounded-full border px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
                      mentorMode || isRecused
                        ? "border-line bg-ink-4 text-dust"
                        : isDone
                          ? "border-jade/60 bg-jade/10 text-jade"
                          : canScore
                            ? "border-crimson/60 bg-crimson/10 text-crimson"
                            : "border-line bg-ink-4 text-dust"
                    }`}
                  >
                    {mentorMode
                      ? "View →"
                      : isRecused
                        ? "Recused"
                        : isDone
                          ? "✓ Scored"
                          : canScore
                            ? "Score →"
                            : "Pending"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
