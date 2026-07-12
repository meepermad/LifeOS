-- LifeOS Phase 2: initial application schema
-- Ownership model: every row is owned by auth.users via user_id (or id for profiles).
-- RLS restricts all access to auth.uid() = owner. No anonymous table access.

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  timezone text not null default 'America/Chicago',
  week_starts_on integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (char_length(trim(email)) > 0),
  constraint profiles_timezone_not_blank check (char_length(trim(timezone)) > 0),
  constraint profiles_week_starts_on_check check (week_starts_on in (0, 1))
);

create unique index profiles_email_lower_unique on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- calendars
-- ---------------------------------------------------------------------------
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid null,
  external_calendar_id text null,
  name text not null,
  source text not null,
  is_visible boolean not null default true,
  is_writable boolean not null default false,
  sync_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendars_name_not_blank check (char_length(trim(name)) > 0),
  constraint calendars_source_check check (
    source in ('manual', 'lifeos', 'workforce_import', 'canvas')
  ),
  constraint calendars_user_name_unique unique (user_id, name)
);

create index calendars_user_id_idx on public.calendars (user_id);
create index calendars_user_source_idx on public.calendars (user_id, source);
create index calendars_user_visible_idx on public.calendars (user_id, is_visible);

create trigger calendars_set_updated_at
  before update on public.calendars
  for each row execute function public.set_updated_at();

alter table public.calendars enable row level security;

create policy "calendars_select_own"
  on public.calendars for select
  to authenticated
  using (auth.uid() = user_id);

create policy "calendars_insert_own"
  on public.calendars for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "calendars_update_own"
  on public.calendars for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "calendars_delete_own"
  on public.calendars for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  external_event_id text null,
  title text not null,
  description text null,
  location text null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  status text not null default 'confirmed',
  source text not null default 'manual',
  event_type text not null default 'other',
  is_read_only boolean not null default false,
  created_by_assistant boolean not null default false,
  assistant_action_id uuid null,
  external_updated_at timestamptz null,
  content_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_not_blank check (char_length(trim(title)) > 0),
  constraint events_end_after_start check (end_at > start_at),
  constraint events_status_check check (
    status in ('tentative', 'confirmed', 'cancelled')
  ),
  constraint events_source_check check (
    source in ('manual', 'lifeos', 'microsoft', 'google', 'canvas', 'workforce_import', 'email')
  ),
  constraint events_event_type_check check (
    event_type in (
      'class', 'work', 'meeting', 'appointment', 'deadline',
      'focus_block', 'travel', 'personal', 'meal', 'exercise', 'other'
    )
  ),
  constraint events_calendar_external_unique unique (calendar_id, external_event_id)
);

create index events_user_id_idx on public.events (user_id);
create index events_calendar_id_idx on public.events (calendar_id);
create index events_user_start_at_idx on public.events (user_id, start_at);
create index events_user_end_at_idx on public.events (user_id, end_at);
create index events_user_start_end_idx on public.events (user_id, start_at, end_at);
create index events_user_event_type_idx on public.events (user_id, event_type);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy "events_select_own"
  on public.events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "events_insert_own"
  on public.events for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "events_update_own"
  on public.events for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "events_delete_own"
  on public.events for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text null,
  source text not null default 'manual',
  external_task_id text null,
  due_at timestamptz null,
  earliest_start_at timestamptz null,
  estimated_minutes integer null,
  remaining_minutes integer null,
  actual_minutes integer null,
  priority integer not null default 3,
  difficulty integer not null default 3,
  status text not null default 'open',
  splittable boolean not null default true,
  minimum_block_minutes integer not null default 25,
  related_event_id uuid null references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint tasks_title_not_blank check (char_length(trim(title)) > 0),
  constraint tasks_priority_check check (priority between 1 and 5),
  constraint tasks_difficulty_check check (difficulty between 1 and 5),
  constraint tasks_estimated_minutes_check check (
    estimated_minutes is null or estimated_minutes >= 0
  ),
  constraint tasks_remaining_minutes_check check (
    remaining_minutes is null or remaining_minutes >= 0
  ),
  constraint tasks_actual_minutes_check check (
    actual_minutes is null or actual_minutes >= 0
  ),
  constraint tasks_minimum_block_check check (
    minimum_block_minutes between 5 and 480
  ),
  constraint tasks_status_check check (
    status in ('open', 'in_progress', 'completed', 'cancelled', 'deferred')
  ),
  constraint tasks_source_check check (
    source in ('manual', 'canvas', 'microsoft', 'google', 'email', 'assistant')
  ),
  constraint tasks_earliest_before_due check (
    earliest_start_at is null
    or due_at is null
    or earliest_start_at <= due_at
  )
);

create unique index tasks_user_source_external_unique
  on public.tasks (user_id, source, external_task_id)
  where external_task_id is not null;

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_due_at_idx on public.tasks (user_id, due_at);
create index tasks_user_priority_idx on public.tasks (user_id, priority);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_related_event_id_idx on public.tasks (related_event_id);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "tasks_select_own"
  on public.tasks for select
  to authenticated
  using (auth.uid() = user_id);

create policy "tasks_insert_own"
  on public.tasks for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "tasks_update_own"
  on public.tasks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks_delete_own"
  on public.tasks for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- availability_rules
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day_of_week integer not null,
  available_start time not null,
  available_end time not null,
  maximum_focus_minutes integer null,
  preferred_block_minutes integer null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_day_of_week_check check (day_of_week between 0 and 6),
  constraint availability_end_after_start check (available_end > available_start),
  constraint availability_max_focus_check check (
    maximum_focus_minutes is null
    or maximum_focus_minutes between 15 and 1440
  ),
  constraint availability_preferred_block_check check (
    preferred_block_minutes is null
    or preferred_block_minutes between 15 and 480
  )
);

create index availability_user_id_idx on public.availability_rules (user_id);
create index availability_user_day_idx on public.availability_rules (user_id, day_of_week);
create index availability_user_day_enabled_idx
  on public.availability_rules (user_id, day_of_week, is_enabled);

create trigger availability_rules_set_updated_at
  before update on public.availability_rules
  for each row execute function public.set_updated_at();

alter table public.availability_rules enable row level security;

create policy "availability_select_own"
  on public.availability_rules for select
  to authenticated
  using (auth.uid() = user_id);

create policy "availability_insert_own"
  on public.availability_rules for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "availability_update_own"
  on public.availability_rules for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "availability_delete_own"
  on public.availability_rules for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- planning_preferences
-- ---------------------------------------------------------------------------
create table public.planning_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  minimum_break_minutes integer not null default 15,
  travel_buffer_minutes integer not null default 15,
  planning_buffer_percent integer not null default 20,
  preferred_focus_block_minutes integer not null default 60,
  maximum_focus_block_minutes integer not null default 120,
  daily_notification_time time null,
  weekly_notification_day integer not null default 0,
  weekly_notification_time time null,
  auto_create_focus_blocks boolean not null default false,
  avoid_difficult_work_after time null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_break_check check (
    minimum_break_minutes between 0 and 240
  ),
  constraint planning_travel_check check (
    travel_buffer_minutes between 0 and 240
  ),
  constraint planning_buffer_check check (
    planning_buffer_percent between 0 and 80
  ),
  constraint planning_preferred_block_check check (
    preferred_focus_block_minutes between 15 and 480
  ),
  constraint planning_max_block_check check (
    maximum_focus_block_minutes between 15 and 720
  ),
  constraint planning_max_gte_preferred check (
    maximum_focus_block_minutes >= preferred_focus_block_minutes
  ),
  constraint planning_weekly_day_check check (
    weekly_notification_day between 0 and 6
  )
);

create trigger planning_preferences_set_updated_at
  before update on public.planning_preferences
  for each row execute function public.set_updated_at();

alter table public.planning_preferences enable row level security;

create policy "planning_preferences_select_own"
  on public.planning_preferences for select
  to authenticated
  using (auth.uid() = user_id);

create policy "planning_preferences_insert_own"
  on public.planning_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "planning_preferences_update_own"
  on public.planning_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Grants: authenticated only for application tables; revoke anon access
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.calendars to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.availability_rules to authenticated;
grant select, insert, update on public.planning_preferences to authenticated;

revoke all on table public.profiles from anon;
revoke all on table public.calendars from anon;
revoke all on table public.events from anon;
revoke all on table public.tasks from anon;
revoke all on table public.availability_rules from anon;
revoke all on table public.planning_preferences from anon;
