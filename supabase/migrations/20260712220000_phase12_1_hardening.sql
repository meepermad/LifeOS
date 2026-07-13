-- LifeOS Phase 12.1: hardening — snapshot immutability, entry quality, course linkage

-- ---------------------------------------------------------------------------
-- task_completion_snapshots: append-only multi-episode
-- ---------------------------------------------------------------------------
alter table public.task_completion_snapshots
  add column completion_sequence integer not null default 1,
  add column superseded_at timestamptz null,
  add column is_current boolean not null default true,
  add column correction_of_snapshot_id uuid null
    references public.task_completion_snapshots (id) on delete set null;

drop index if exists public.task_completion_snapshots_task_unique;

create unique index task_completion_snapshots_one_current_per_task
  on public.task_completion_snapshots (task_id)
  where is_current = true;

create index task_completion_snapshots_task_sequence_idx
  on public.task_completion_snapshots (user_id, task_id, completion_sequence desc);

-- ---------------------------------------------------------------------------
-- task_time_entries: review state
-- ---------------------------------------------------------------------------
alter table public.task_time_entries
  add column review_state text not null default 'valid',
  add column review_reason text null,
  add column reviewed_at timestamptz null;

alter table public.task_time_entries
  add constraint task_time_entries_review_state_check check (
    review_state in ('valid', 'needs_review', 'excluded', 'corrected')
  );

-- ---------------------------------------------------------------------------
-- timer_pause_segments: one open pause per entry
-- ---------------------------------------------------------------------------
create unique index timer_pause_segments_one_open_per_entry
  on public.timer_pause_segments (entry_id)
  where resumed_at is null;

-- ---------------------------------------------------------------------------
-- course linkage
-- ---------------------------------------------------------------------------
alter table public.courses
  add column canvas_course_id text null;

alter table public.tasks
  add column course_id uuid null references public.courses (id) on delete set null;

create index tasks_user_course_idx on public.tasks (user_id, course_id);

-- ---------------------------------------------------------------------------
-- planning_block_feedback: partial minutes
-- ---------------------------------------------------------------------------
alter table public.planning_block_feedback
  add column partial_minutes integer null;

alter table public.planning_block_feedback
  add constraint planning_block_feedback_partial_minutes_check check (
    partial_minutes is null or partial_minutes >= 0
  );
