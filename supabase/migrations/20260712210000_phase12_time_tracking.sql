-- LifeOS Phase 12B: task time tracking, estimate revisions, completion snapshots, planning feedback

-- ---------------------------------------------------------------------------
-- task_time_entries
-- ---------------------------------------------------------------------------
create table public.task_time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid null references public.tasks (id) on delete set null,
  task_title_snapshot text null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  duration_seconds integer null,
  entry_source text not null default 'timer',
  note text null,
  parent_entry_id uuid null references public.task_time_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_time_entries_source_check check (
    entry_source in ('timer', 'manual', 'adjustment', 'planning_block')
  ),
  constraint task_time_entries_duration_check check (
    duration_seconds is null or duration_seconds >= 0
  ),
  constraint task_time_entries_end_after_start check (
    ended_at is null or ended_at > started_at
  )
);

create unique index task_time_entries_one_active_timer_per_user
  on public.task_time_entries (user_id)
  where ended_at is null and entry_source = 'timer';

create index task_time_entries_user_task_idx
  on public.task_time_entries (user_id, task_id, started_at desc);

create trigger task_time_entries_set_updated_at
  before update on public.task_time_entries
  for each row execute function public.set_updated_at();

alter table public.task_time_entries enable row level security;

create policy "task_time_entries_select_own"
  on public.task_time_entries for select
  to authenticated
  using (auth.uid() = user_id);

create policy "task_time_entries_insert_own"
  on public.task_time_entries for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "task_time_entries_update_own"
  on public.task_time_entries for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "task_time_entries_delete_own"
  on public.task_time_entries for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.task_time_entries to authenticated;
revoke all on table public.task_time_entries from anon;

-- ---------------------------------------------------------------------------
-- timer_pause_segments
-- ---------------------------------------------------------------------------
create table public.timer_pause_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.task_time_entries (id) on delete cascade,
  paused_at timestamptz not null,
  resumed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint timer_pause_end_after_start check (
    resumed_at is null or resumed_at > paused_at
  )
);

create index timer_pause_segments_entry_idx
  on public.timer_pause_segments (entry_id, paused_at);

alter table public.timer_pause_segments enable row level security;

create policy "timer_pause_segments_select_own"
  on public.timer_pause_segments for select
  to authenticated
  using (auth.uid() = user_id);

create policy "timer_pause_segments_insert_own"
  on public.timer_pause_segments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "timer_pause_segments_update_own"
  on public.timer_pause_segments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.timer_pause_segments to authenticated;
revoke all on table public.timer_pause_segments from anon;

-- ---------------------------------------------------------------------------
-- task_estimate_revisions
-- ---------------------------------------------------------------------------
create table public.task_estimate_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  previous_minutes integer null,
  new_minutes integer null,
  revision_source text not null,
  reason text null,
  created_at timestamptz not null default now(),
  constraint task_estimate_revisions_source_check check (
    revision_source in ('manual', 'assistant', 'planning', 'completion_review')
  )
);

create index task_estimate_revisions_task_idx
  on public.task_estimate_revisions (user_id, task_id, created_at desc);

alter table public.task_estimate_revisions enable row level security;

create policy "task_estimate_revisions_select_own"
  on public.task_estimate_revisions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "task_estimate_revisions_insert_own"
  on public.task_estimate_revisions for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.task_estimate_revisions to authenticated;
revoke all on table public.task_estimate_revisions from anon;

-- ---------------------------------------------------------------------------
-- task_completion_snapshots
-- ---------------------------------------------------------------------------
create table public.task_completion_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  completed_at timestamptz not null,
  original_estimate_minutes integer null,
  current_estimate_minutes integer null,
  tracked_seconds integer not null default 0,
  adjustment_seconds integer not null default 0,
  final_actual_seconds integer not null default 0,
  estimate_revision_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint task_completion_snapshots_seconds_check check (
    tracked_seconds >= 0
    and adjustment_seconds >= 0
    and final_actual_seconds >= 0
  )
);

create unique index task_completion_snapshots_task_unique
  on public.task_completion_snapshots (task_id);

alter table public.task_completion_snapshots enable row level security;

create policy "task_completion_snapshots_select_own"
  on public.task_completion_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

create policy "task_completion_snapshots_insert_own"
  on public.task_completion_snapshots for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.task_completion_snapshots to authenticated;
revoke all on table public.task_completion_snapshots from anon;

-- ---------------------------------------------------------------------------
-- planning_block_feedback
-- ---------------------------------------------------------------------------
create table public.planning_block_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  proposal_id uuid null references public.planning_proposals (id) on delete set null,
  feedback text not null,
  note text null,
  created_at timestamptz not null default now(),
  constraint planning_block_feedback_check check (
    feedback in ('completed', 'partial', 'skipped', 'rescheduled')
  )
);

create index planning_block_feedback_event_idx
  on public.planning_block_feedback (user_id, event_id, created_at desc);

alter table public.planning_block_feedback enable row level security;

create policy "planning_block_feedback_select_own"
  on public.planning_block_feedback for select
  to authenticated
  using (auth.uid() = user_id);

create policy "planning_block_feedback_insert_own"
  on public.planning_block_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "planning_block_feedback_update_own"
  on public.planning_block_feedback for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.planning_block_feedback to authenticated;
revoke all on table public.planning_block_feedback from anon;

-- ---------------------------------------------------------------------------
-- planning_preferences: adaptive planning + stale timer
-- ---------------------------------------------------------------------------
alter table public.planning_preferences
  add column adaptive_planning_enabled boolean not null default true,
  add column calibration_reset_at timestamptz null,
  add column stale_timer_threshold_hours integer not null default 4,
  add column stale_timer_notified_at timestamptz null;

alter table public.tasks
  add column planning_estimate_override text null;

alter table public.tasks
  add constraint tasks_planning_estimate_override_check check (
    planning_estimate_override is null
    or planning_estimate_override in ('original', 'adaptive')
  );
