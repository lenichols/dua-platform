-- ============================================================
-- 0007_submissions_open_flag.sql
-- Gate the project submission form behind an admin switch, separate
-- from registration. Submissions stay CLOSED (default false) until an
-- admin opens them from the admin panel. Idempotent.
-- ============================================================

alter table public.event_state
  add column if not exists submissions_open boolean not null default false;
