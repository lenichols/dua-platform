-- ============================================================
-- 0015_admin_audiences.sql
-- Lets a campaign target the admin team instead of registrants,
-- so a draft can be trialled on a handful of colleagues before
-- it goes to everyone.
--
-- 'admins'       — every active admin account
-- 'super_admins' — active super administrators only
--
-- These read from admin_users, not registrations, so they have no
-- unsubscribe link: staff can't opt out of operational mail, and
-- there's no registration row to stamp. Handled in
-- src/lib/campaigns.ts and src/app/admin/actions.ts.
--
-- Run in Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.email_campaigns
  drop constraint if exists email_campaigns_audience_check;

alter table public.email_campaigns
  add constraint email_campaigns_audience_check
  check (audience in ('all', 'participant', 'mentor', 'admins', 'super_admins'));
