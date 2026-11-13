-- ============================================================
-- 0005_registration_partner_org.sql
-- Capture partner-organization affiliation on registrations
-- (the groups the event partners with).
-- Stored as a comma-joined list of selected orgs. Idempotent.
-- ============================================================

alter table public.registrations
  add column if not exists partner_org text;
