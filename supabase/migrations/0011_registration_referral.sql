-- ============================================================
-- 0011_registration_referral.sql
-- Capture who referred a registrant (participant or mentor).
-- Free text — the name of the person/org that referred them.
-- Idempotent.
-- ============================================================

alter table public.registrations
  add column if not exists referred_by text;
