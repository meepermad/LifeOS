-- Fix push subscription RPCs: must run as SECURITY DEFINER after authenticated
-- table grants were revoked. SECURITY INVOKER cannot insert/select/update
-- push_subscriptions when the caller has no direct table privileges.

-- ---------------------------------------------------------------------------
-- register_push_subscription
-- ---------------------------------------------------------------------------
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_name text default null,
  p_user_agent text default null,
  p_content_encoding text default null
)
returns table (
  id uuid,
  device_name text,
  is_active boolean,
  last_successful_push timestamptz,
  last_failed_push timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.push_subscriptions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_endpoint is null or char_length(p_endpoint) = 0 or char_length(p_endpoint) > 2048 then
    raise exception 'Invalid endpoint' using errcode = '22023';
  end if;

  if p_p256dh is null or char_length(p_p256dh) = 0 or char_length(p_p256dh) > 512 then
    raise exception 'Invalid p256dh key' using errcode = '22023';
  end if;

  if p_auth is null or char_length(p_auth) = 0 or char_length(p_auth) > 512 then
    raise exception 'Invalid auth key' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    device_name,
    user_agent,
    content_encoding,
    is_active,
    failure_count
  )
  values (
    v_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_device_name,
    p_user_agent,
    p_content_encoding,
    true,
    0
  )
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    device_name = excluded.device_name,
    user_agent = excluded.user_agent,
    content_encoding = excluded.content_encoding,
    is_active = true,
    failure_count = 0,
    updated_at = now()
  where public.push_subscriptions.user_id = v_user_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Subscription endpoint is registered to another account'
      using errcode = '42501';
  end if;

  return query
  select
    v_row.id,
    v_row.device_name,
    v_row.is_active,
    v_row.last_successful_push,
    v_row.last_failed_push,
    v_row.created_at;
end;
$$;

revoke all on function public.register_push_subscription(
  text, text, text, text, text, text
) from public;
grant execute on function public.register_push_subscription(
  text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- list_push_device_summaries
-- ---------------------------------------------------------------------------
create or replace function public.list_push_device_summaries()
returns table (
  id uuid,
  device_name text,
  is_active boolean,
  last_successful_push timestamptz,
  last_failed_push timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ps.id,
    ps.device_name,
    ps.is_active,
    ps.last_successful_push,
    ps.last_failed_push,
    ps.created_at
  from public.push_subscriptions ps
  where ps.user_id = auth.uid()
  order by ps.created_at desc;
$$;

revoke all on function public.list_push_device_summaries() from public;
grant execute on function public.list_push_device_summaries() to authenticated;

-- ---------------------------------------------------------------------------
-- deactivate_push_subscription
-- ---------------------------------------------------------------------------
create or replace function public.deactivate_push_subscription(
  p_subscription_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  update public.push_subscriptions
  set is_active = false
  where id = p_subscription_id
    and user_id = v_user_id;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.deactivate_push_subscription(uuid) from public;
grant execute on function public.deactivate_push_subscription(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- deactivate_push_subscription_by_endpoint
-- ---------------------------------------------------------------------------
create or replace function public.deactivate_push_subscription_by_endpoint(
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_endpoint is null or char_length(p_endpoint) = 0 or char_length(p_endpoint) > 2048 then
    raise exception 'Invalid endpoint' using errcode = '22023';
  end if;

  update public.push_subscriptions
  set is_active = false
  where endpoint = p_endpoint
    and user_id = v_user_id;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.deactivate_push_subscription_by_endpoint(text) from public;
grant execute on function public.deactivate_push_subscription_by_endpoint(text) to authenticated;

-- ---------------------------------------------------------------------------
-- is_push_endpoint_registered — current-device status reconciliation
-- ---------------------------------------------------------------------------
create or replace function public.is_push_endpoint_registered(
  p_endpoint text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.push_subscriptions ps
    where ps.user_id = auth.uid()
      and ps.endpoint = p_endpoint
      and ps.is_active = true
  );
$$;

revoke all on function public.is_push_endpoint_registered(text) from public;
grant execute on function public.is_push_endpoint_registered(text) to authenticated;
