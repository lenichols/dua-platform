-- ============================================================
-- 0010_mentor_role.sql
-- Public mentor sign-up (/mentor). Mentors live in the same
-- registrations table as participants, distinguished by `role`,
-- so the admin panel, CSV export, and email audiences stay in
-- one place. Adds `occupation` (mentor title/role). The unique
-- email index becomes (email, role) so the same person can
-- register as both a participant and a mentor. Idempotent.
-- ============================================================

alter table public.registrations
  add column if not exists role text not null default 'participant'
    check (role in ('participant', 'mentor')),
  add column if not exists occupation text;

drop index if exists registrations_email_uniq;

create unique index if not exists registrations_email_role_uniq
  on public.registrations (lower(email), role);
