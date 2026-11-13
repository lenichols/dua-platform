-- ============================================================
-- 0012_admin_users.sql
-- Multiple admin accounts for /admin, with roles:
--   owner  — everything, including managing this table
--   admin  — every operational control, but can't manage accounts
--   viewer — READ ONLY (registration counts, judging progress, results)
--
-- Passwords are scrypt hashes produced by src/lib/admin-password.ts —
-- never store plaintext here. The legacy shared ADMIN_PASSWORD env var
-- keeps working as an owner-level break-glass login, so nobody can get
-- locked out before the first account is created.
--
-- Run in Supabase → SQL Editor. Idempotent: safe to re-run.
-- ============================================================

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  password_hash text not null,
  role text not null default 'viewer'
    check (role in ('owner', 'admin', 'viewer')),
  is_active boolean not null default true,
  created_by text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Emails are matched case-insensitively at sign-in.
create unique index if not exists admin_users_email_uniq
  on public.admin_users (lower(email));

drop trigger if exists admin_users_touch on public.admin_users;
create trigger admin_users_touch before update on public.admin_users
  for each row execute function public.touch_updated_at();

-- RLS on with NO policies = nothing but the service-role key can touch
-- this table. All access goes through server actions in /admin.
alter table public.admin_users enable row level security;

revoke all on public.admin_users from anon, authenticated;
