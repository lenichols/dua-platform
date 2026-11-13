-- ============================================================
-- 0014_email_campaigns.sql
-- Email blasts to registrants, composed in /admin and sent via
-- Resend.
--
-- Two pieces:
--   1. registrations.unsubscribed_at — bulk mail needs a working
--      opt-out. Recipients are filtered on this, and the public
--      /unsubscribe route stamps it. Nulls mean subscribed, so
--      every existing registrant is opted in by default.
--   2. email_campaigns — an audit trail of what actually went
--      out, to whom, and how it landed. Without it there's no way
--      to answer "did we already send this?" after the fact.
--
-- Run in Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.registrations
  add column if not exists unsubscribed_at timestamptz;

create index if not exists registrations_subscribed_idx
  on public.registrations (role)
  where unsubscribed_at is null;

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_html text not null,
  audience text not null default 'all'
    check (audience in ('all', 'participant', 'mentor')),
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  error_detail text,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_campaigns_created_at_idx
  on public.email_campaigns (created_at desc);

drop trigger if exists email_campaigns_touch on public.email_campaigns;
create trigger email_campaigns_touch before update on public.email_campaigns
  for each row execute function public.touch_updated_at();

-- RLS on with no policies = service role only, same as admin_users.
-- Campaign bodies are drafted by staff and shouldn't be public
-- before (or after) they're sent.
alter table public.email_campaigns enable row level security;

revoke all on public.email_campaigns from anon, authenticated;
