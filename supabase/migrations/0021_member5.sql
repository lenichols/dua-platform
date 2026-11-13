-- ============================================================
-- 0021_member5.sql
-- Teams can have up to five people: the submitter plus four
-- more. Adds the fifth member's columns, mirroring member4:
-- name is judge-visible, email / LinkedIn / occupation /
-- country stay admin-only (same policy as 0009).
--
-- Idempotent: safe to re-run.
-- ============================================================

alter table public.submissions
  add column if not exists member5_name text,
  add column if not exists member5_email text,
  add column if not exists member5_linkedin_url text,
  add column if not exists member5_occupation text,
  add column if not exists member5_country text;

-- Judge-facing view: everything from 0020 plus member5_name,
-- appended so `create or replace` can extend it in place.
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
  problem_brief,
  member5_name
from public.submissions
where coalesce(hidden_from_judges, false) = false
  and coalesce(is_submission_complete, true) = true;

grant select on public.submissions_public to authenticated, anon;

notify pgrst, 'reload schema';
