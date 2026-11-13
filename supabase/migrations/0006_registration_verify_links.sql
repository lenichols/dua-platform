-- ============================================================
-- 0006_registration_verify_links.sql
-- Collect a LinkedIn profile and/or personal website from
-- registrants so organizers can verify who they are. Idempotent.
-- ============================================================

alter table public.registrations
  add column if not exists linkedin_url text,
  add column if not exists website_url text;
