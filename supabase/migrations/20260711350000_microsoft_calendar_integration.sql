-- LifeOS Phase 8: Microsoft 365 calendar integration

-- ---------------------------------------------------------------------------
-- connections: Microsoft provider + safe metadata
-- ---------------------------------------------------------------------------
alter table public.connections
  drop constraint connections_provider_check;

alter table public.connections
  add constraint connections_provider_check check (
    provider in ('canvas_ics', 'microsoft')
  );

alter table public.connections
  add column if not exists external_tenant_id text null,
  add column if not exists external_home_account_id text null,
  add column if not exists requires_reauthentication boolean not null default false,
  add column if not exists credentials_version integer not null default 0;

create unique index if not exists connections_user_microsoft_unique
  on public.connections (user_id)
  where provider = 'microsoft';

-- ---------------------------------------------------------------------------
-- calendars: Microsoft source + per-connection external ID uniqueness
-- ---------------------------------------------------------------------------
alter table public.calendars
  drop constraint calendars_source_check;

alter table public.calendars
  add constraint calendars_source_check check (
    source in ('manual', 'lifeos', 'workforce_import', 'canvas', 'microsoft')
  );

create unique index if not exists calendars_connection_external_unique
  on public.calendars (connection_id, external_calendar_id)
  where connection_id is not null and external_calendar_id is not null;

-- ---------------------------------------------------------------------------
-- sync_states: per-calendar cursor for Graph delta sync
-- ---------------------------------------------------------------------------
drop index if exists public.sync_states_connection_id_unique;

alter table public.sync_states
  add column if not exists sync_cursor text null,
  add column if not exists last_full_sync_at timestamptz null;

create unique index if not exists sync_states_calendar_id_unique
  on public.sync_states (calendar_id)
  where calendar_id is not null;

-- ---------------------------------------------------------------------------
-- events: minimal Outlook metadata
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists external_change_key text null,
  add column if not exists show_as text null,
  add column if not exists sensitivity text null,
  add column if not exists organizer_name text null,
  add column if not exists online_meeting_url text null;

-- ---------------------------------------------------------------------------
-- claim_connection_for_sync — support Microsoft + reauth guard
-- ---------------------------------------------------------------------------
create or replace function public.claim_connection_for_sync(
  p_connection_id uuid,
  p_stale_minutes integer default 15
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection public.connections%rowtype;
  v_now timestamptz := now();
  v_stale_threshold timestamptz := v_now - (p_stale_minutes || ' minutes')::interval;
begin
  select *
  into v_connection
  from public.connections
  where id = p_connection_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if auth.uid() is not null and auth.uid() <> v_connection.user_id then
    return 'not_found';
  end if;

  if v_connection.encrypted_credentials is null then
    return 'not_connected';
  end if;

  if v_connection.provider not in ('canvas_ics', 'microsoft') then
    return 'not_connected';
  end if;

  if v_connection.requires_reauthentication then
    return 'not_connected';
  end if;

  if v_connection.status = 'disconnected' then
    return 'not_connected';
  end if;

  if v_connection.status = 'syncing'
    and v_connection.last_sync_attempt is not null
    and v_connection.last_sync_attempt > v_stale_threshold then
    return 'already_running';
  end if;

  if v_connection.status not in ('connected', 'error', 'syncing') then
    return 'not_connected';
  end if;

  update public.connections
  set
    status = 'syncing',
    last_sync_attempt = v_now,
    updated_at = v_now
  where id = p_connection_id;

  return 'claimed';
end;
$$;
