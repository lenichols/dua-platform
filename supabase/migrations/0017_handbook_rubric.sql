-- ============================================================
-- 0017_handbook_rubric.sql
-- Score on the Judge Handbook's six weighted criteria instead of
-- the original categories:
--
--   Innovation 20% · Feasibility 20% · Scale of Impact 20%
--   Scalability 15% · Affordability 15% · Team Composition 10%
--
-- Scale of Impact is the tie-breaker. The weights also live in
-- src/lib/rubric.ts — keep the two in sync.
--
-- The old columns (idea, creativity, build_quality, ux,
-- presentation, impact) stay, but become nullable, so a build
-- deployed before this migration keeps working until the new one
-- is live. New scores fill only the new columns.
--
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.scores
  add column if not exists innovation int
    check (innovation between 1 and 10),
  add column if not exists feasibility int
    check (feasibility between 1 and 10),
  add column if not exists scale_of_impact int
    check (scale_of_impact between 1 and 10),
  add column if not exists scalability int
    check (scalability between 1 and 10),
  add column if not exists affordability int
    check (affordability between 1 and 10),
  add column if not exists team_composition int
    check (team_composition between 1 and 10);

alter table public.scores
  alter column idea drop not null,
  alter column creativity drop not null,
  alter column build_quality drop not null,
  alter column ux drop not null,
  alter column presentation drop not null,
  alter column impact drop not null;

-- Aggregates on the new criteria. A new function rather than a change to
-- submission_aggregates(), whose return type the old build still reads.
-- Same gate as before (results phase, or an admin), plus the service role so
-- organizers can preview the leaderboard from /results before publishing.
-- Rows scored on the old rubric are ignored.
create or replace function public.score_aggregates()
returns table (
  submission_id uuid,
  project_name text,
  n_judges int,
  avg_innovation numeric,
  avg_feasibility numeric,
  avg_scale_of_impact numeric,
  avg_scalability numeric,
  avg_affordability numeric,
  avg_team_composition numeric,
  avg_weighted numeric
)
language sql
security definer
set search_path = public
as $$
  with gate as (
    select
      (select phase from public.event_state where id = 1) = 'results'
      or public.is_admin()
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role' as ok
  ),
  scored as (
    select * from public.scores where innovation is not null
  )
  select
    s.id,
    s.project_name,
    count(sc.id)::int as n_judges,
    avg(sc.innovation)::numeric(5,2),
    avg(sc.feasibility)::numeric(5,2),
    avg(sc.scale_of_impact)::numeric(5,2),
    avg(sc.scalability)::numeric(5,2),
    avg(sc.affordability)::numeric(5,2),
    avg(sc.team_composition)::numeric(5,2),
    avg(
      0.20 * sc.innovation
      + 0.20 * sc.feasibility
      + 0.20 * sc.scale_of_impact
      + 0.15 * sc.scalability
      + 0.15 * sc.affordability
      + 0.10 * sc.team_composition
    )::numeric(5,2)
  from public.submissions s
  left join scored sc on sc.submission_id = s.id
  where (select ok from gate)
  group by s.id, s.project_name;
$$;

grant execute on function public.score_aggregates() to authenticated, anon;

notify pgrst, 'reload schema';
