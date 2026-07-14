-- LifeOS Phase 13.1B: append-only due-date revision history

create table public.task_due_date_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  previous_due_at timestamptz null,
  new_due_at timestamptz null,
  reason text null,
  source text not null,
  review_session_id uuid null references public.review_sessions (id) on delete set null,
  assistant_action_id uuid null references public.assistant_actions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint task_due_date_revisions_source_check check (
    source in (
      'manual',
      'daily_review',
      'weekly_review',
      'smart_reschedule',
      'assistant',
      'recurrence',
      'canvas_sync'
    )
  )
);

create index task_due_date_revisions_task_idx
  on public.task_due_date_revisions (user_id, task_id, created_at desc);

create index task_due_date_revisions_session_idx
  on public.task_due_date_revisions (review_session_id)
  where review_session_id is not null;

alter table public.task_due_date_revisions enable row level security;

create policy "task_due_date_revisions_select_own"
  on public.task_due_date_revisions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "task_due_date_revisions_insert_own"
  on public.task_due_date_revisions for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.task_due_date_revisions to authenticated;
revoke all on table public.task_due_date_revisions from anon;
revoke update, delete on table public.task_due_date_revisions from authenticated;
