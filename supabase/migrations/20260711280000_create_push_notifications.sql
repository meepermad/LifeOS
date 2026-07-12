-- LifeOS Phase 5: Web Push subscriptions, notification deliveries, and preference fields

-- ---------------------------------------------------------------------------
-- planning_preferences notification fields
-- ---------------------------------------------------------------------------
alter table public.planning_preferences
  add column if not exists notifications_enabled boolean not null default false,
  add column if not exists notification_privacy_mode text not null default 'private',
  add column if not exists daily_notifications_enabled boolean not null default true,
  add column if not exists weekly_notifications_enabled boolean not null default true,
  add column if not exists deadline_notifications_enabled boolean not null default true,
  add column if not exists overload_notifications_enabled boolean not null default true,
  add column if not exists deadline_warning_hours integer not null default 24,
  add column if not exists quiet_hours_start time null,
  add column if not exists quiet_hours_end time null;

alter table public.planning_preferences
  add constraint planning_preferences_privacy_mode_check check (
    notification_privacy_mode in ('private', 'detailed')
  );

alter table public.planning_preferences
  add constraint planning_preferences_deadline_warning_hours_check check (
    deadline_warning_hours >= 1 and deadline_warning_hours <= 168
  );

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_name text null,
  user_agent text null,
  content_encoding text null,
  is_active boolean not null default true,
  last_successful_push timestamptz null,
  last_failed_push timestamptz null,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_failure_count_check check (failure_count >= 0)
);

create index push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create index push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, is_active);

create index push_subscriptions_endpoint_idx
  on public.push_subscriptions (endpoint);

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

revoke all on table public.push_subscriptions from anon;

-- ---------------------------------------------------------------------------
-- notification_deliveries
-- ---------------------------------------------------------------------------
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null,
  scheduled_for timestamptz not null,
  period_start timestamptz null,
  period_end timestamptz null,
  deduplication_key text not null,
  status text not null,
  subscription_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  safe_error text null,
  payload_summary jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz null,
  constraint notification_deliveries_dedup_key_unique unique (deduplication_key),
  constraint notification_deliveries_type_check check (
    notification_type in (
      'test',
      'daily_agenda',
      'weekly_summary',
      'deadline_warning',
      'overload_warning'
    )
  ),
  constraint notification_deliveries_status_check check (
    status in ('pending', 'sending', 'sent', 'partial', 'failed', 'skipped')
  ),
  constraint notification_deliveries_subscription_count_check check (subscription_count >= 0),
  constraint notification_deliveries_success_count_check check (success_count >= 0),
  constraint notification_deliveries_failure_count_check check (failure_count >= 0)
);

create index notification_deliveries_user_status_idx
  on public.notification_deliveries (user_id, status);

create index notification_deliveries_user_scheduled_idx
  on public.notification_deliveries (user_id, scheduled_for);

create index notification_deliveries_type_scheduled_idx
  on public.notification_deliveries (notification_type, scheduled_for);

create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notification_deliveries enable row level security;

create policy "notification_deliveries_select_own"
  on public.notification_deliveries for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.notification_deliveries to authenticated;

revoke all on table public.notification_deliveries from anon;
