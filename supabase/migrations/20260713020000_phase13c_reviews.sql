-- LifeOS Phase 13C: daily and weekly review sessions

create table public.review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  review_type text not null,
  review_date date null,
  review_week_start date null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  summary_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_sessions_type_check check (
    review_type in ('morning_daily', 'evening_daily', 'weekly')
  ),
  constraint review_sessions_date_scope_check check (
    (review_type = 'weekly' and review_week_start is not null and review_date is null)
    or (review_type != 'weekly' and review_date is not null and review_week_start is null)
  )
);

create unique index review_sessions_one_completed_daily
  on public.review_sessions (user_id, review_type, review_date)
  where completed_at is not null and review_date is not null;

create unique index review_sessions_one_completed_weekly
  on public.review_sessions (user_id, review_type, review_week_start)
  where completed_at is not null and review_week_start is not null;

create trigger review_sessions_set_updated_at
  before update on public.review_sessions
  for each row execute function public.set_updated_at();

alter table public.review_sessions enable row level security;

create policy "review_sessions_select_own"
  on public.review_sessions for select to authenticated
  using (auth.uid() = user_id);
create policy "review_sessions_insert_own"
  on public.review_sessions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "review_sessions_update_own"
  on public.review_sessions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "review_sessions_delete_own"
  on public.review_sessions for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.review_sessions to authenticated;
revoke all on table public.review_sessions from anon;

-- ---------------------------------------------------------------------------
-- review_decisions
-- ---------------------------------------------------------------------------
create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.review_sessions (id) on delete cascade,
  task_id uuid null references public.tasks (id) on delete set null,
  decision_type text not null,
  decision_payload jsonb null,
  created_at timestamptz not null default now()
);

create index review_decisions_session_idx
  on public.review_decisions (session_id);

create index review_decisions_task_idx
  on public.review_decisions (user_id, task_id);

alter table public.review_decisions enable row level security;

create policy "review_decisions_select_own"
  on public.review_decisions for select to authenticated
  using (auth.uid() = user_id);
create policy "review_decisions_insert_own"
  on public.review_decisions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "review_decisions_update_own"
  on public.review_decisions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "review_decisions_delete_own"
  on public.review_decisions for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.review_decisions to authenticated;
revoke all on table public.review_decisions from anon;

-- ---------------------------------------------------------------------------
-- daily_priorities
-- ---------------------------------------------------------------------------
create table public.daily_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  priority_date date not null,
  task_id uuid not null references public.tasks (id) on delete cascade,
  priority_rank integer not null,
  priority_level text not null default 'primary',
  created_at timestamptz not null default now(),
  constraint daily_priorities_rank_check check (priority_rank between 1 and 10),
  constraint daily_priorities_level_check check (
    priority_level in ('primary', 'secondary', 'not_today')
  ),
  constraint daily_priorities_unique_task unique (user_id, priority_date, task_id)
);

create index daily_priorities_date_idx
  on public.daily_priorities (user_id, priority_date, priority_rank);

alter table public.daily_priorities enable row level security;

create policy "daily_priorities_select_own"
  on public.daily_priorities for select to authenticated
  using (auth.uid() = user_id);
create policy "daily_priorities_insert_own"
  on public.daily_priorities for insert to authenticated
  with check (auth.uid() = user_id);
create policy "daily_priorities_update_own"
  on public.daily_priorities for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_priorities_delete_own"
  on public.daily_priorities for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.daily_priorities to authenticated;
revoke all on table public.daily_priorities from anon;

-- ---------------------------------------------------------------------------
-- weekly_priorities
-- ---------------------------------------------------------------------------
create table public.weekly_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start_date date not null,
  task_id uuid not null references public.tasks (id) on delete cascade,
  priority_rank integer not null,
  created_at timestamptz not null default now(),
  constraint weekly_priorities_rank_check check (priority_rank between 1 and 10),
  constraint weekly_priorities_unique_task unique (user_id, week_start_date, task_id)
);

create index weekly_priorities_week_idx
  on public.weekly_priorities (user_id, week_start_date, priority_rank);

alter table public.weekly_priorities enable row level security;

create policy "weekly_priorities_select_own"
  on public.weekly_priorities for select to authenticated
  using (auth.uid() = user_id);
create policy "weekly_priorities_insert_own"
  on public.weekly_priorities for insert to authenticated
  with check (auth.uid() = user_id);
create policy "weekly_priorities_update_own"
  on public.weekly_priorities for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly_priorities_delete_own"
  on public.weekly_priorities for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.weekly_priorities to authenticated;
revoke all on table public.weekly_priorities from anon;
