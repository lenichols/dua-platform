-- ============================================================
-- 0016_campaign_images.sql
-- Storage bucket for images embedded in email campaigns.
--
-- The bucket is PUBLIC on purpose. Email clients fetch images
-- anonymously, with no session and no way to send an auth header,
-- so a signed or private URL simply renders as a broken image in
-- every inbox. Only admins can upload (writes go through a
-- service-role server action); the world can read.
--
-- Don't put anything sensitive in here — treat it as a CDN.
--
-- Run in Supabase → SQL Editor. Idempotent.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('campaign-images', 'campaign-images', true)
on conflict (id) do update set public = true;

-- Anonymous read so inboxes can load the images.
drop policy if exists campaign_images_public_read on storage.objects;
create policy campaign_images_public_read on storage.objects
  for select
  using (bucket_id = 'campaign-images');

-- No insert/update/delete policies: uploads run with the service-role key
-- from the admin server action, which bypasses RLS. Nobody else can write.
