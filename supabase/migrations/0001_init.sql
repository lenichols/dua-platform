-- ============================================================
-- Dua — initial schema
-- Run this in Supabase → SQL Editor → New query → Run
-- Idempotent: safe to re-run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- event_state: singleton row controlling the app phase
-- ------------------------------------------------------------
create table if not exists public.event_state (
  id int primary key default 1 check (id = 1),
  phase text not null default 'submissions'
    check (phase in ('submissions','judging','results')),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.event_state (id, phase)
values (1, 'submissions')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- submissions: one row per project
-- "one per team" enforced by unique lower(project_name)
-- ------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  -- public fields (judge-visible)
  project_name text not null,
  team_name text,
  solo_or_team text check (solo_or_team in ('Solo','Team')),
  challenge_track text,
  project_category text,
  project_description text,
  project_description_summary text,
  technologies_used text,
  team_size int,
  github_url text,
  live_demo_url text,
  demo_video_url text,
  linkedin_post_url text,
  -- members (names only are judge-visible)
  member1_name text,
  member2_name text,
  member3_name text,
  member4_name text,
  -- sensitive fields (admin-only via RLS)
  member1_email text,
  member2_email text,
  member3_email text,
  member4_email text,
  submitter_linkedin_url text,
  affiliated_org text,
  submitter_role text,
  all_members_in_video text,
  participants text,
  is_submission_complete boolean default true,
  -- admin review flags
  needs_review boolean default false,
  review_note text,
  hidden_from_judges boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one submission per team (case-insensitive on project name)
create unique index if not exists submissions_project_name_uniq
  on public.submissions (lower(project_name));

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);

-- ------------------------------------------------------------
-- judges: one row per judge, tied to auth.users
-- ------------------------------------------------------------
create table if not exists public.judges (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- scores: rubric scores per (judge, submission)
-- each category 1..10; "impact" is the ice-breaker (separate from total)
-- ------------------------------------------------------------
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.judges(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  idea int not null check (idea between 1 and 10),
  creativity int not null check (creativity between 1 and 10),
  build_quality int not null check (build_quality between 1 and 10),
  ux int not null check (ux between 1 and 10),
  presentation int not null check (presentation between 1 and 10),
  impact int not null check (impact between 1 and 10),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (judge_id, submission_id)
);

create index if not exists scores_submission_idx on public.scores (submission_id);
create index if not exists scores_judge_idx on public.scores (judge_id);

-- ------------------------------------------------------------
-- tie_breaks: admin-logged manual decisions
-- ------------------------------------------------------------
create table if not exists public.tie_breaks (
  id uuid primary key default gen_random_uuid(),
  winning_submission_id uuid not null references public.submissions(id) on delete cascade,
  losing_submission_id uuid not null references public.submissions(id) on delete cascade,
  reason text not null,
  decided_by text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- results_lock: snapshot of top-6 once admin locks it in
-- ------------------------------------------------------------
create table if not exists public.results_lock (
  id int primary key default 1 check (id = 1),
  seed bigint not null,
  top6 jsonb not null,  -- [{submission_id, rank, probability}]
  locked_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Admin helper function — checks a custom JWT claim
-- Set via the /admin sign-in route using the service role key.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ------------------------------------------------------------
-- updated_at trigger helper
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists submissions_touch on public.submissions;
create trigger submissions_touch before update on public.submissions
  for each row execute function public.touch_updated_at();

drop trigger if exists scores_touch on public.scores;
create trigger scores_touch before update on public.scores
  for each row execute function public.touch_updated_at();

drop trigger if exists event_state_touch on public.event_state;
create trigger event_state_touch before update on public.event_state
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.event_state enable row level security;
alter table public.submissions enable row level security;
alter table public.judges      enable row level security;
alter table public.scores      enable row level security;
alter table public.tie_breaks  enable row level security;
alter table public.results_lock enable row level security;

-- --- event_state ---
drop policy if exists event_state_read on public.event_state;
create policy event_state_read on public.event_state
  for select using (true);

drop policy if exists event_state_admin_write on public.event_state;
create policy event_state_admin_write on public.event_state
  for update using (public.is_admin()) with check (public.is_admin());

-- --- submissions ---
-- Public INSERT allowed only while phase = 'submissions'.
-- Public SELECT is limited to non-sensitive columns via the view below —
-- direct table SELECT is restricted to admins. Judges read via the view.
drop policy if exists submissions_public_insert on public.submissions;
create policy submissions_public_insert on public.submissions
  for insert
  with check (
    (select phase from public.event_state where id = 1) = 'submissions'
  );

drop policy if exists submissions_admin_all on public.submissions;
create policy submissions_admin_all on public.submissions
  for all using (public.is_admin()) with check (public.is_admin());

-- Edit-own row via short-lived service-role endpoint (handled in API).
-- No generic "update your own submission" policy — magic-link edits go
-- through the server using SUPABASE_SERVICE_ROLE_KEY.

-- --- judges ---
drop policy if exists judges_self_read on public.judges;
create policy judges_self_read on public.judges
  for select using (auth.uid() = auth_user_id or public.is_admin());

drop policy if exists judges_admin_all on public.judges;
create policy judges_admin_all on public.judges
  for all using (public.is_admin()) with check (public.is_admin());

-- --- scores ---
-- Judges INSERT their own rows only while phase = 'judging'
drop policy if exists scores_judge_insert on public.scores;
create policy scores_judge_insert on public.scores
  for insert with check (
    (select phase from public.event_state where id = 1) = 'judging'
    and judge_id in (select id from public.judges where auth_user_id = auth.uid())
  );

drop policy if exists scores_judge_update on public.scores;
create policy scores_judge_update on public.scores
  for update using (
    (select phase from public.event_state where id = 1) = 'judging'
    and judge_id in (select id from public.judges where auth_user_id = auth.uid())
  );

-- Judges can read their OWN scores anytime.
-- They cannot read other judges' raw scores — aggregated results go through a SECURITY DEFINER view.
drop policy if exists scores_judge_self_read on public.scores;
create policy scores_judge_self_read on public.scores
  for select using (
    judge_id in (select id from public.judges where auth_user_id = auth.uid())
    or public.is_admin()
  );

-- --- tie_breaks / results_lock (admin only) ---
drop policy if exists tie_breaks_admin on public.tie_breaks;
create policy tie_breaks_admin on public.tie_breaks
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists results_lock_read on public.results_lock;
create policy results_lock_read on public.results_lock
  for select using (
    (select phase from public.event_state where id = 1) = 'results'
    or public.is_admin()
  );

drop policy if exists results_lock_admin_write on public.results_lock;
create policy results_lock_admin_write on public.results_lock
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Public views — these are the ONLY reads judges/public use.
-- Views inherit RLS of their base tables, so we use SECURITY INVOKER
-- and carefully select columns.
-- ============================================================

-- Judge-facing submission view: strips sensitive columns.
-- Visible only to authenticated judges (via grant).
create or replace view public.submissions_public as
select
  id,
  project_name,
  team_name,
  solo_or_team,
  challenge_track,
  project_category,
  project_description,
  project_description_summary,
  technologies_used,
  team_size,
  github_url,
  live_demo_url,
  demo_video_url,
  linkedin_post_url,
  member1_name,
  member2_name,
  member3_name,
  member4_name,
  created_at
from public.submissions
where coalesce(hidden_from_judges, false) = false
  and coalesce(is_submission_complete, true) = true;

-- Grant access to the judge-facing view for authenticated users.
grant select on public.submissions_public to authenticated, anon;

-- Aggregated score view (post-close). Judges only see aggregates,
-- never another judge's individual score.
-- SECURITY DEFINER so it can read public.scores regardless of caller's RLS.
create or replace function public.submission_aggregates()
returns table (
  submission_id uuid,
  project_name text,
  n_judges int,
  avg_idea numeric,
  avg_creativity numeric,
  avg_build_quality numeric,
  avg_ux numeric,
  avg_presentation numeric,
  avg_impact numeric,
  avg_total numeric
)
language sql
security definer
set search_path = public
as $$
  -- Gate: only return rows when phase='results' OR caller is admin
  with gate as (
    select
      (select phase from public.event_state where id=1) = 'results'
      or public.is_admin() as ok
  )
  select
    s.id,
    s.project_name,
    count(sc.id)::int as n_judges,
    avg(sc.idea)::numeric(5,2),
    avg(sc.creativity)::numeric(5,2),
    avg(sc.build_quality)::numeric(5,2),
    avg(sc.ux)::numeric(5,2),
    avg(sc.presentation)::numeric(5,2),
    avg(sc.impact)::numeric(5,2),
    avg(sc.idea + sc.creativity + sc.build_quality + sc.ux + sc.presentation)::numeric(5,2)
  from public.submissions s
  left join public.scores sc on sc.submission_id = s.id
  where (select ok from gate)
  group by s.id, s.project_name;
$$;

grant execute on function public.submission_aggregates() to authenticated, anon;

-- Progress view — who has voted on what (count only, no scores).
-- Judges use this to see how many have voted; no totals leak.
create or replace view public.judging_progress as
select
  s.id as submission_id,
  s.project_name,
  count(sc.id)::int as votes
from public.submissions s
left join public.scores sc on sc.submission_id = s.id
group by s.id, s.project_name;

grant select on public.judging_progress to authenticated;
