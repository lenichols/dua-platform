-- ============================================================
-- 0023_registration_open_flag.sql
-- Registration (participants at /register, mentors at /mentor)
-- gets its own admin switch, like submissions_open. Both forms
-- still close outright once the phase leaves "submissions".
--
-- Created closed: submissions have closed for 2026, so sign-ups
-- end with them.
--
-- Idempotent: safe to re-run (re-running doesn't reopen it).
-- ============================================================

alter table public.event_state
  add column if not exists registration_open boolean not null default false;

notify pgrst, 'reload schema';
