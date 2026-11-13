-- ============================================================
-- 0013_super_admins.sql
-- "Super administrator" tier: protected accounts that other
-- admins cannot demote, deactivate, delete, or reset.
--
-- Kept as a flag rather than a fourth role because it's
-- orthogonal to what a role grants. Role answers "what can you
-- do?"; is_protected answers "who is allowed to do it to you?".
-- Folding it into the role enum would have meant every future
-- permission check carrying a fourth case it doesn't care about.
--
-- Rule enforced in src/app/admin/actions.ts: only a protected
-- account may modify another protected account. The shared
-- ADMIN_PASSWORD break-glass session counts as protected — it's
-- the recovery path if every founder loses access, and whoever
-- holds the server environment already controls everything.
--
-- Run in Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.admin_users
  add column if not exists is_protected boolean not null default false;

-- Mark your own founding accounts as protected once they exist, e.g.:
--
--   update public.admin_users
--   set is_protected = true
--   where lower(email) in ('founder@example.org');
