-- ============================================================
-- 0008_registration_phone.sql
-- Capture a contact phone number on registrations. Stored as
-- free text (international formats vary). Idempotent.
-- ============================================================

alter table public.registrations
  add column if not exists phone text;
