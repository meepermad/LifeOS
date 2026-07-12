-- LifeOS Phase 4: blocks_time on events and workload_snapshots cache table

-- ---------------------------------------------------------------------------
-- events.blocks_time
-- ---------------------------------------------------------------------------
alter table public.events
  add column blocks_time boolean not null default true;

update public.events
set blocks_time = false
where event_type = 'deadline';

-- ---------------------------------------------------------------------------
-- workload_snapshots
-- ---------------------------------------------------------------------------
create table public.workload_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_type text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  fixed_minutes integer not null,
  raw_open_minutes integer not null,
  reserved_buffer_minutes integer not null,
  available_focus_minutes integer not null,
  required_task_minutes integer not null,
  allocated_task_minutes integer not null,
  unallocated_task_minutes integer not null,
  scheduled_focus_minutes integer not null,
  unestimated_task_count integer not null,
  overdue_task_count integer not null,
  capacity_ratio numeric null,
  status text not null,
  summary jsonb not null,
  input_hash text null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workload_snapshots_period_type_check check (
    period_type in ('day', 'week')
  ),
  constraint workload_snapshots_status_check check (
    status in (
      'clear',
      'manageable',
      'heavy',
      'overloaded',
      'no_capacity',
      'incomplete_data'
    )
  ),
  constraint workload_snapshots_fixed_minutes_check check (fixed_minutes >= 0),
  constraint workload_snapshots_raw_open_minutes_check check (raw_open_minutes >= 0),
  constraint workload_snapshots_reserved_buffer_check check (reserved_buffer_minutes >= 0),
  constraint workload_snapshots_available_focus_check check (available_focus_minutes >= 0),
  constraint workload_snapshots_required_task_check check (required_task_minutes >= 0),
  constraint workload_snapshots_allocated_task_check check (allocated_task_minutes >= 0),
  constraint workload_snapshots_unallocated_task_check check (unallocated_task_minutes >= 0),
  constraint workload_snapshots_scheduled_focus_check check (scheduled_focus_minutes >= 0),
  constraint workload_snapshots_unestimated_count_check check (unestimated_task_count >= 0),
  constraint workload_snapshots_overdue_count_check check (overdue_task_count >= 0),
  constraint workload_snapshots_user_period_unique unique (
    user_id,
    period_type,
    period_start,
    period_end
  )
);

create index workload_snapshots_user_period_idx
  on public.workload_snapshots (user_id, period_type, period_start);

create index workload_snapshots_user_calculated_idx
  on public.workload_snapshots (user_id, calculated_at desc);

create trigger workload_snapshots_set_updated_at
  before update on public.workload_snapshots
  for each row execute function public.set_updated_at();

alter table public.workload_snapshots enable row level security;

create policy "workload_snapshots_select_own"
  on public.workload_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

create policy "workload_snapshots_insert_own"
  on public.workload_snapshots for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "workload_snapshots_update_own"
  on public.workload_snapshots for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workload_snapshots_delete_own"
  on public.workload_snapshots for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.workload_snapshots to authenticated;

revoke all on table public.workload_snapshots from anon;
