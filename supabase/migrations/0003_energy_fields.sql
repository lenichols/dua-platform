-- ============================================================
-- 0003_energy_fields.sql
-- Submission form fields.
--
-- Adds global contact/location fields and energy-specific
-- project fields to public.submissions, and exposes the
-- non-PII energy/context fields to the judge-facing view.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.submissions
  -- global contact / location (PII — admin-only)
  add column if not exists phone text,
  add column if not exists country text,
  add column if not exists state_region text,
  add column if not exists city text,
  -- energy-specific project context (judge-visible)
  add column if not exists energy_sector text,
  add column if not exists impact_focus text,   -- comma-joined: Access / Affordability / Availability
  add column if not exists target_region text,
  add column if not exists solution_stage text;

-- ------------------------------------------------------------
-- Judge-facing view: re-create to expose the new energy/context
-- columns (country is low-sensitivity location context; phone,
-- city and state_region stay admin-only).
--
-- create-or-replace requires the existing columns to remain in
-- the same order; the new columns are appended at the end.
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
  country
from public.submissions
where coalesce(hidden_from_judges, false) = false
  and coalesce(is_submission_complete, true) = true;

grant select on public.submissions_public to authenticated, anon;
