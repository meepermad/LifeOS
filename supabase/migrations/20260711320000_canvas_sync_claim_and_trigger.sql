-- LifeOS Phase 6.6: atomic Canvas sync claim and last_sync_trigger

alter table public.connections
  add column last_sync_trigger text null,
  add constraint connections_last_sync_trigger_check check (
    last_sync_trigger is null or last_sync_trigger in ('manual', 'scheduled')
  );

-- ---------------------------------------------------------------------------
-- claim_connection_for_sync — atomic concurrency protection for Canvas sync
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

  if v_connection.provider <> 'canvas_ics'
    or v_connection.encrypted_credentials is null then
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

revoke all on function public.claim_connection_for_sync(uuid, integer) from public;
grant execute on function public.claim_connection_for_sync(uuid, integer) to authenticated;
