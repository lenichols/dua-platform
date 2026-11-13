-- ============================================================
-- 0022_judge_view_gate.sql
-- submissions_public runs as its owner, so it skips the RLS on
-- submissions, and it was granted to anon: anyone holding the
-- site's public key could read every submission, at any phase.
--
-- Now it returns rows only to a signed-in, active judge or
-- mentor, and only once judging has started (judging or results
-- phase). Admins read the submissions table with the service
-- role and are unaffected.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- Same columns, in the same order, as 0021.
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
  and coalesce(is_submission_complete, true) = true
  and exists (
    select 1 from public.judges j
    where j.auth_user_id = auth.uid() and j.is_active
  )
  and exists (
    select 1 from public.event_state e
    where e.id = 1 and e.phase in ('judging', 'results')
  );

revoke select on public.submissions_public from anon;
grant select on public.submissions_public to authenticated;

notify pgrst, 'reload schema';
