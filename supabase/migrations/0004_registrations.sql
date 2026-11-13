-- ============================================================
-- 0004_registrations.sql
-- Public pre-event registration.
--
-- Separate from project submissions. This is the public signup
-- collected from the marketing homepage (/register) that builds
-- the participant list; the project submission form (/submit) is
-- sent to registrants during the event. Idempotent.
-- ============================================================

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  country text,
  participating_as text check (participating_as in ('Solo','Team')),
  team_name text,
  primary_interest text,
  experience_level text,
  organization text,
  heard_about text,
  created_at timestamptz not null default now()
);

-- One registration per email (case-insensitive).
create unique index if not exists registrations_email_uniq
  on public.registrations (lower(email));

create index if not exists registrations_created_at_idx
  on public.registrations (created_at desc);

-- RLS: deny by default. The public registration action and the admin panel
-- both go through the service-role client, which bypasses RLS — so registrant
-- PII is never directly readable by the public or by judges. No anon/auth
-- policies are added on purpose.
alter table public.registrations enable row level security;
