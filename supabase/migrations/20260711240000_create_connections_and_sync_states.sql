-- LifeOS Phase 3: connections and sync_states for Canvas ICS synchronization

-- ---------------------------------------------------------------------------
-- connections
-- ---------------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  display_name text null,
  encrypted_credentials text null,
  status text not null default 'disconnected',
  last_sync_attempt timestamptz null,
  last_successful_sync timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_provider_check check (
    provider in ('canvas_ics')
  ),
  constraint connections_status_check check (
    status in ('disconnected', 'connected', 'syncing', 'error')
  )
);

create index connections_user_id_idx on public.connections (user_id);
create index connections_user_provider_idx on public.connections (user_id, provider);
create index connections_status_idx on public.connections (status);

create unique index connections_user_canvas_ics_unique
  on public.connections (user_id)
  where provider = 'canvas_ics';

create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

alter table public.connections enable row level security;

create policy "connections_select_own"
  on public.connections for select
  to authenticated
  using (auth.uid() = user_id);

create policy "connections_insert_own"
  on public.connections for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "connections_update_own"
  on public.connections for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "connections_delete_own"
  on public.connections for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- sync_states
-- ---------------------------------------------------------------------------
create table public.sync_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  calendar_id uuid null references public.calendars (id) on delete cascade,
  feed_hash text null,
  last_synced_at timestamptz null,
  last_seen_event_count integer null,
  sync_window_start timestamptz null,
  sync_window_end timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_states_last_seen_event_count_check check (
    last_seen_event_count is null or last_seen_event_count >= 0
  )
);

create unique index sync_states_connection_id_unique
  on public.sync_states (connection_id);

create index sync_states_user_id_idx on public.sync_states (user_id);
create index sync_states_calendar_id_idx on public.sync_states (calendar_id);

create trigger sync_states_set_updated_at
  before update on public.sync_states
  for each row execute function public.set_updated_at();

alter table public.sync_states enable row level security;

create policy "sync_states_select_own"
  on public.sync_states for select
  to authenticated
  using (auth.uid() = user_id);

create policy "sync_states_insert_own"
  on public.sync_states for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "sync_states_update_own"
  on public.sync_states for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sync_states_delete_own"
  on public.sync_states for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Link calendars to connections
-- ---------------------------------------------------------------------------
alter table public.calendars
  add constraint calendars_connection_id_fkey
  foreign key (connection_id) references public.connections (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only; revoke anon
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.connections to authenticated;
grant select, insert, update, delete on public.sync_states to authenticated;

revoke all on table public.connections from anon;
revoke all on table public.sync_states from anon;
