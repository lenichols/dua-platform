-- ============================================================
-- 0020_handbook_v2_rubric.sql
-- The revised Judge Handbook (§8) scores five criteria from 1 to
-- 5, each with one sentence of evidence:
--
--   Impact 25% · Innovation 25% · Sustainability (incl.
--   affordability) 25% · Feasibility 15% · Scalability 10%
--
--   Total = 20 × weighted sum → out of 100
--
-- Ties: higher Impact, then higher Innovation. The weights also
-- live in src/lib/rubric.ts — keep the two in sync.
--
-- Reuses impact / innovation / feasibility / scalability from
-- earlier rubrics and adds sustainability plus an evidence column
-- per criterion. A score on this rubric is one with sustainability
-- set; rows from 0017 (scored 1–10, no sustainability) are ignored
-- by rubric_aggregates() and the top-6 maths.
--
-- Also records which of the 16 problem briefs a team worked on.
--
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.scores
  add column if not exists sustainability int,
  add column if not exists impact_evidence text,
  add column if not exists innovation_evidence text,
  add column if not exists sustainability_evidence text,
  add column if not exists feasibility_evidence text,
  add column if not exists scalability_evidence text;

-- 1–5 for every criterion on this rubric. Rows without sustainability
-- (older rubrics, 1–10) are left alone.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'scores_handbook_v2_range'
  ) then
    alter table public.scores add constraint scores_handbook_v2_range check (
      sustainability is null or (
        sustainability between 1 and 5
        and impact between 1 and 5
        and innovation between 1 and 5
        and feasibility between 1 and 5
        and scalability between 1 and 5
      )
    );
  end if;
end $$;

create or replace function public.rubric_aggregates()
returns table (
  submission_id uuid,
  project_name text,
  n_judges int,
  avg_impact numeric,
  avg_innovation numeric,
  avg_sustainability numeric,
  avg_feasibility numeric,
  avg_scalability numeric,
  avg_total numeric
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
    select * from public.scores where sustainability is not null
  )
  select
    s.id,
    s.project_name,
    count(sc.id)::int as n_judges,
    avg(sc.impact)::numeric(5,2),
    avg(sc.innovation)::numeric(5,2),
    avg(sc.sustainability)::numeric(5,2),
    avg(sc.feasibility)::numeric(5,2),
    avg(sc.scalability)::numeric(5,2),
    avg(
      20 * (
        0.25 * sc.impact
        + 0.25 * sc.innovation
        + 0.25 * sc.sustainability
        + 0.15 * sc.feasibility
        + 0.10 * sc.scalability
      )
    )::numeric(5,2)
  from public.submissions s
  left join scored sc on sc.submission_id = s.id
  where (select ok from gate)
  group by s.id, s.project_name;
$$;

grant execute on function public.rubric_aggregates() to authenticated, anon;

-- Problem brief (1–16, or the team's own problem), shown to judges.
alter table public.submissions
  add column if not exists problem_brief text;

-- Judge-facing view: everything from 0018 plus problem_brief, appended so
-- `create or replace` can extend it in place.
create or replace view public.submissions_public as
select
  id,
  project_name,
  team_name,
  solo_or_team,
  challenge_track,
  project_category,
  project_description,
  project_description_summary,
  technologies_used,
  team_size,
  github_url,
  live_demo_url,
  demo_video_url,
  linkedin_post_url,
  member1_name,
  member2_name,
  member3_name,
  member4_name,
  created_at,
  energy_sector,
  impact_focus,
  target_region,
  solution_stage,
  country,
  customer_type,
  region,
  area_of_specification,
  problem_statement,
  core_energy_problem,
  applies_ai,
  mentor_name,
  demo_video_short_url,
  pitch_deck_url,
  summary_url,
  disclosure_statement,
  problem_brief
from public.submissions
where coalesce(hidden_from_judges, false) = false
  and coalesce(is_submission_complete, true) = true;

grant select on public.submissions_public to authenticated, anon;

notify pgrst, 'reload schema';
