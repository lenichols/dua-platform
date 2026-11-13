-- ============================================================
-- 0019_recusals.sql
-- A judge with a conflict of interest (Judge Handbook §12) can
-- recuse themselves from a submission. It leaves their queue and
-- progress count, any score they gave it is removed, and
-- organizers see the declaration in /admin.
--
-- Judges read their own rows. Writes go through the server
-- (service role), so the recusal and the removal of that judge's
-- score happen together.
--
-- Idempotent: safe to re-run.
-- ============================================================

create table if not exists public.recusals (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.judges(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (judge_id, submission_id)
);

create index if not exists recusals_submission_idx
  on public.recusals (submission_id);

alter table public.recusals enable row level security;

drop policy if exists recusals_judge_self_read on public.recusals;
create policy recusals_judge_self_read on public.recusals
  for select using (
    judge_id in (select id from public.judges where auth_user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists recusals_admin_all on public.recusals;
create policy recusals_admin_all on public.recusals
  for all using (public.is_admin()) with check (public.is_admin());

-- A recused judge can't score that submission, even by calling the API
-- directly. Same rules as 0002_mentors, plus the recusal check.
drop policy if exists scores_judge_insert on public.scores;
create policy scores_judge_insert on public.scores
  for insert with check (
    (select phase from public.event_state where id = 1) = 'judging'
    and judge_id in (
      select id from public.judges
      where auth_user_id = auth.uid() and role = 'judge'
    )
    and not exists (
      select 1 from public.recusals r
      where r.judge_id = scores.judge_id
        and r.submission_id = scores.submission_id
    )
  );

drop policy if exists scores_judge_update on public.scores;
create policy scores_judge_update on public.scores
  for update using (
    (select phase from public.event_state where id = 1) = 'judging'
    and judge_id in (
      select id from public.judges
      where auth_user_id = auth.uid() and role = 'judge'
    )
    and not exists (
      select 1 from public.recusals r
      where r.judge_id = scores.judge_id
        and r.submission_id = scores.submission_id
    )
  );

notify pgrst, 'reload schema';
