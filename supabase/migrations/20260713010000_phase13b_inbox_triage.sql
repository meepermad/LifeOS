-- LifeOS Phase 13B: inbox and triage workflow columns

alter table public.tasks
  add column inbox_at timestamptz null,
  add column workflow_state text not null default 'actionable',
  add column waiting_reason text null,
  add column waiting_follow_up_at timestamptz null,
  add column deferred_until_at timestamptz null;

alter table public.tasks
  add constraint tasks_workflow_state_check check (
    workflow_state in ('actionable', 'waiting', 'someday', 'backlog')
  );

create index tasks_inbox_idx
  on public.tasks (user_id, inbox_at)
  where inbox_at is not null;

create index tasks_workflow_state_idx
  on public.tasks (user_id, workflow_state)
  where workflow_state != 'actionable';

create index tasks_deferred_until_idx
  on public.tasks (user_id, deferred_until_at)
  where deferred_until_at is not null;
