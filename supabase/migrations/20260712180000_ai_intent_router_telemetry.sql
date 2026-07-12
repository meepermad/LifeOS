-- Phase 11: AI intent router telemetry and daily usage caps

-- ---------------------------------------------------------------------------
-- ai_intent_router_daily_usage
-- ---------------------------------------------------------------------------
create table public.ai_intent_router_daily_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_intent_router_daily_usage_count_check check (request_count >= 0),
  constraint ai_intent_router_daily_usage_user_date_unique unique (user_id, usage_date)
);

create index ai_intent_router_daily_usage_user_id_idx
  on public.ai_intent_router_daily_usage (user_id);

create index ai_intent_router_daily_usage_date_idx
  on public.ai_intent_router_daily_usage (usage_date);

create trigger set_ai_intent_router_daily_usage_updated_at
  before update on public.ai_intent_router_daily_usage
  for each row execute function public.set_updated_at();

alter table public.ai_intent_router_daily_usage enable row level security;

create policy "ai_intent_router_daily_usage_select_own"
  on public.ai_intent_router_daily_usage for select
  using (auth.uid() = user_id);

create policy "ai_intent_router_daily_usage_insert_own"
  on public.ai_intent_router_daily_usage for insert
  with check (auth.uid() = user_id);

create policy "ai_intent_router_daily_usage_update_own"
  on public.ai_intent_router_daily_usage for update
  using (auth.uid() = user_id);

grant select, insert, update on table public.ai_intent_router_daily_usage to authenticated;
revoke all on table public.ai_intent_router_daily_usage from anon;

-- ---------------------------------------------------------------------------
-- ai_intent_router_telemetry (privacy-safe metadata only)
-- ---------------------------------------------------------------------------
create table public.ai_intent_router_telemetry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  model text not null,
  schema_version smallint not null default 1,
  selected_intent text null,
  confidence_bucket text null,
  status text not null,
  error_category text null,
  latency_bucket_ms text null,
  usage_units integer null,
  created_at timestamptz not null default now(),
  retention_expires_at timestamptz not null default (now() + interval '30 days'),
  constraint ai_intent_router_telemetry_status_check check (
    status in ('success', 'failure')
  )
);

create index ai_intent_router_telemetry_user_id_idx
  on public.ai_intent_router_telemetry (user_id);

create index ai_intent_router_telemetry_retention_idx
  on public.ai_intent_router_telemetry (retention_expires_at);

alter table public.ai_intent_router_telemetry enable row level security;

create policy "ai_intent_router_telemetry_select_own"
  on public.ai_intent_router_telemetry for select
  using (auth.uid() = user_id);

create policy "ai_intent_router_telemetry_insert_own"
  on public.ai_intent_router_telemetry for insert
  with check (auth.uid() = user_id);

grant select, insert on table public.ai_intent_router_telemetry to authenticated;
revoke all on table public.ai_intent_router_telemetry from anon;

create or replace function public.purge_expired_ai_intent_router_telemetry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.ai_intent_router_telemetry
  where retention_expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_ai_intent_router_telemetry() from public;
grant execute on function public.purge_expired_ai_intent_router_telemetry() to authenticated;
