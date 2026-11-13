-- ============================================================
-- 0018_submission_deliverables.sql
-- The Judge Handbook (§7) asks every team for a pitch deck, a
-- one-page summary and a disclosure statement. Collect them on
-- the submission form and show them to judges and mentors.
--
--   pitch_deck_url        link to the deck (PDF)
--   summary_url           link to the one-page summary (PDF)
--   disclosure_statement  what existed before the sprint vs. what
--                         was built during it; AI tools,
--                         open-source code and datasets used
--
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.submissions
  add column if not exists pitch_deck_url text,
  add column if not exists summary_url text,
  add column if not exists disclosure_statement text;

-- Judge-facing view: everything from 0009 plus the three new columns,
-- appended at the end so `create or replace` can extend it in place.
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
  disclosure_statement
from public.submissions
where coalesce(hidden_from_judges, false) = false
  and coalesce(is_submission_complete, true) = true;

grant select on public.submissions_public to authenticated, anon;

notify pgrst, 'reload schema';
