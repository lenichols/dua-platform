-- ============================================================
-- Mentors: read-only viewers of submissions.
-- Reuses the `judges` table with a new `role` column so the
-- magic-link sign-in flow stays the same. RLS prevents mentors
-- from writing scores.
-- Idempotent.
-- ============================================================

alter table public.judges
  add column if not exists role text not null default 'judge'
    check (role in ('judge', 'mentor'));

create index if not exists judges_role_idx on public.judges (role);

-- --- scores: tighten policies so only role='judge' can write ---
drop policy if exists scores_judge_insert on public.scores;
create policy scores_judge_insert on public.scores
  for insert with check (
    (select phase from public.event_state where id = 1) = 'judging'
    and judge_id in (
      select id from public.judges
      where auth_user_id = auth.uid() and role = 'judge'
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
  );
