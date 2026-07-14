-- LifeOS Phase 13.1C: review session idempotency and decision constraints

alter table public.review_sessions
  add column if not exists current_step integer not null default 0;

create unique index if not exists review_sessions_one_incomplete_daily
  on public.review_sessions (user_id, review_type, review_date)
  where completed_at is null and review_date is not null;

create unique index if not exists review_sessions_one_incomplete_weekly
  on public.review_sessions (user_id, review_type, review_week_start)
  where completed_at is null and review_week_start is not null;

alter table public.review_decisions
  add column if not exists supersedes_decision_id uuid null
    references public.review_decisions (id) on delete set null;

alter table public.review_decisions
  drop constraint if exists review_decisions_type_check;

alter table public.review_decisions
  add constraint review_decisions_type_check check (
    decision_type in (
      'keep_due_date',
      'move_due_date',
      'change_deadline',
      'schedule_tomorrow',
      'return_to_inbox',
      'split_task',
      'reduce_scope',
      'mark_waiting',
      'cancel',
      'confirm_priority',
      'defer',
      'acknowledge'
    )
  );

create unique index if not exists review_decisions_session_task_type_unique
  on public.review_decisions (session_id, task_id, decision_type)
  where task_id is not null;

-- Soft-dedupe: allow correction rows that supersede
-- corrections still need distinct types or supersedes_decision_id path
