-- ============================================================
-- 0009_google_form_parity.sql
-- Bring /submit up to parity with the official Google submission
-- form the event used before:
--   · residential vs non-residential customer type
--   · continent/region + area of specification
--   · problem statement, core energy problem, AI yes/no
--   · mentor name + LinkedIn
--   · optional short (< 2 min) highlight video
--   · per-member LinkedIn / occupation / country
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.submissions
  -- project context (judge-visible)
  add column if not exists customer_type text,          -- Residential / Non-residential
  add column if not exists region text,                 -- continent
  add column if not exists area_of_specification text,
  add column if not exists problem_statement text,
  add column if not exists core_energy_problem text,
  add column if not exists applies_ai text,             -- Yes / No
  add column if not exists mentor_name text,
  add column if not exists demo_video_short_url text,
  -- admin-only detail
  add column if not exists mentor_linkedin_url text,
  add column if not exists member2_linkedin_url text,
  add column if not exists member2_occupation text,
  add column if not exists member2_country text,
  add column if not exists member3_linkedin_url text,
  add column if not exists member3_occupation text,
  add column if not exists member3_country text,
  add column if not exists member4_linkedin_url text,
  add column if not exists member4_occupation text,
  add column if not exists member4_country text;

-- ------------------------------------------------------------
-- Judge-facing view: re-create to expose the new judge-relevant
-- columns. Member LinkedIn/occupation/country and the mentor's
-- LinkedIn stay admin-only (PII-lean, same policy as 0003).
-- create-or-replace requires existing columns to keep their
-- order; new columns are appended at the end.
-- ------------------------------------------------------------
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
  demo_video_short_url
from public.submissions
where coalesce(hidden_from_judges, false) = false
  and coalesce(is_submission_complete, true) = true;

grant select on public.submissions_public to authenticated, anon;
