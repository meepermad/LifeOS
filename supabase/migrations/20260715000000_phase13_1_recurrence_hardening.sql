-- LifeOS Phase 13.1A: recurrence lifecycle hardening

alter table public.task_recurrence_templates
  add column if not exists archived_at timestamptz null,
  add column if not exists ended_at timestamptz null,
  add column if not exists future_edit_policy text null default 'update_future_incomplete';

alter table public.task_recurrence_templates
  drop constraint if exists task_recurrence_templates_future_edit_policy_check;

alter table public.task_recurrence_templates
  add constraint task_recurrence_templates_future_edit_policy_check check (
    future_edit_policy is null
    or future_edit_policy in (
      'leave_unchanged',
      'update_future_incomplete',
      'cancel_and_regenerate'
    )
  );

alter table public.tasks
  add column if not exists is_manually_customized boolean not null default false,
  add column if not exists manually_detached_from_recurrence boolean not null default false;

create index if not exists tasks_recurrence_customized_idx
  on public.tasks (user_id, recurrence_template_id)
  where recurrence_template_id is not null and is_manually_customized = true;
