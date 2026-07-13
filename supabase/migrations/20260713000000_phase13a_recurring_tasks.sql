-- LifeOS Phase 13A: recurring task templates and instances

-- ---------------------------------------------------------------------------
-- task_recurrence_templates
-- ---------------------------------------------------------------------------
create table public.task_recurrence_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text null,
  task_category text null,
  course_id uuid null references public.courses (id) on delete set null,
  default_estimate_minutes integer null,
  default_priority integer not null default 3,
  default_difficulty integer not null default 3,
  recurrence_rule jsonb not null,
  recurrence_timezone text not null default 'America/Chicago',
  first_occurrence_date date not null,
  due_time text null,
  generation_horizon_days integer not null default 45,
  end_date date null,
  occurrence_limit integer null,
  is_active boolean not null default true,
  paused_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_recurrence_templates_title_not_blank check (char_length(trim(title)) > 0),
  constraint task_recurrence_templates_priority_check check (
    default_priority between 1 and 5
  ),
  constraint task_recurrence_templates_difficulty_check check (
    default_difficulty between 1 and 5
  ),
  constraint task_recurrence_templates_estimate_check check (
    default_estimate_minutes is null or default_estimate_minutes >= 0
  ),
  constraint task_recurrence_templates_horizon_check check (
    generation_horizon_days between 7 and 90
  ),
  constraint task_recurrence_templates_due_time_format check (
    due_time is null or due_time ~ '^\d{2}:\d{2}$'
  ),
  constraint task_recurrence_templates_occurrence_limit_check check (
    occurrence_limit is null or occurrence_limit > 0
  )
);

create index task_recurrence_templates_user_active_idx
  on public.task_recurrence_templates (user_id, is_active)
  where is_active = true;

create trigger task_recurrence_templates_set_updated_at
  before update on public.task_recurrence_templates
  for each row execute function public.set_updated_at();

alter table public.task_recurrence_templates enable row level security;

create policy "task_recurrence_templates_select_own"
  on public.task_recurrence_templates for select
  to authenticated
  using (auth.uid() = user_id);

create policy "task_recurrence_templates_insert_own"
  on public.task_recurrence_templates for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "task_recurrence_templates_update_own"
  on public.task_recurrence_templates for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "task_recurrence_templates_delete_own"
  on public.task_recurrence_templates for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.task_recurrence_templates to authenticated;
revoke all on table public.task_recurrence_templates from anon;

-- ---------------------------------------------------------------------------
-- task_recurrence_exceptions
-- ---------------------------------------------------------------------------
create table public.task_recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.task_recurrence_templates (id) on delete cascade,
  occurrence_date date not null,
  exception_type text not null,
  moved_to_date date null,
  override_title text null,
  override_estimate_minutes integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_recurrence_exceptions_type_check check (
    exception_type in ('skipped', 'moved', 'customised', 'cancelled')
  ),
  constraint task_recurrence_exceptions_estimate_check check (
    override_estimate_minutes is null or override_estimate_minutes >= 0
  ),
  constraint task_recurrence_exceptions_unique_occurrence unique (template_id, occurrence_date)
);

create index task_recurrence_exceptions_template_idx
  on public.task_recurrence_exceptions (template_id, occurrence_date);

create trigger task_recurrence_exceptions_set_updated_at
  before update on public.task_recurrence_exceptions
  for each row execute function public.set_updated_at();

alter table public.task_recurrence_exceptions enable row level security;

create policy "task_recurrence_exceptions_select_own"
  on public.task_recurrence_exceptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "task_recurrence_exceptions_insert_own"
  on public.task_recurrence_exceptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "task_recurrence_exceptions_update_own"
  on public.task_recurrence_exceptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "task_recurrence_exceptions_delete_own"
  on public.task_recurrence_exceptions for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.task_recurrence_exceptions to authenticated;
revoke all on table public.task_recurrence_exceptions from anon;

-- ---------------------------------------------------------------------------
-- Extend tasks for recurrence instances and subtasks
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column recurrence_template_id uuid null
    references public.task_recurrence_templates (id) on delete set null,
  add column recurrence_occurrence_key text null,
  add column parent_task_id uuid null
    references public.tasks (id) on delete set null;

create unique index tasks_recurrence_occurrence_unique
  on public.tasks (recurrence_template_id, recurrence_occurrence_key)
  where recurrence_template_id is not null and recurrence_occurrence_key is not null;

create index tasks_recurrence_template_idx
  on public.tasks (user_id, recurrence_template_id)
  where recurrence_template_id is not null;

create index tasks_parent_task_idx
  on public.tasks (user_id, parent_task_id)
  where parent_task_id is not null;
