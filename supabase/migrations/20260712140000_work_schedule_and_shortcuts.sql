-- LifeOS Phase 9: work schedule capture and Apple Shortcuts bridge

-- ---------------------------------------------------------------------------
-- Rename employer-branded work calendar
-- ---------------------------------------------------------------------------
update public.calendars
set name = 'Work', source = 'manual', updated_at = now()
where name = 'Home Depot Work';

-- ---------------------------------------------------------------------------
-- Event shift metadata
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists unpaid_break_minutes integer not null default 0,
  add column if not exists shift_source_label text null,
  add column if not exists shift_note text null;

alter table public.events
  drop constraint if exists events_unpaid_break_minutes_check;

alter table public.events
  add constraint events_unpaid_break_minutes_check check (
    unpaid_break_minutes >= 0 and unpaid_break_minutes < 480
  );

-- ---------------------------------------------------------------------------
-- work_shift_templates
-- ---------------------------------------------------------------------------
create table public.work_shift_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  start_time text not null,
  end_time text not null,
  unpaid_break_minutes integer not null default 0,
  location text null,
  label text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_shift_templates_name_not_blank check (char_length(trim(name)) > 0),
  constraint work_shift_templates_break_check check (
    unpaid_break_minutes >= 0 and unpaid_break_minutes < 480
  ),
  unique (user_id, name)
);

create trigger work_shift_templates_set_updated_at
  before update on public.work_shift_templates
  for each row execute function public.set_updated_at();

alter table public.work_shift_templates enable row level security;

create policy "work_shift_templates_select_own"
  on public.work_shift_templates for select
  to authenticated
  using (auth.uid() = user_id);

create policy "work_shift_templates_insert_own"
  on public.work_shift_templates for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "work_shift_templates_update_own"
  on public.work_shift_templates for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "work_shift_templates_delete_own"
  on public.work_shift_templates for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.work_shift_templates to authenticated;
revoke all on table public.work_shift_templates from anon;

-- ---------------------------------------------------------------------------
-- shortcut_devices
-- ---------------------------------------------------------------------------
create table public.shortcut_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  is_active boolean not null default true,
  spoken_detail_level text not null default 'private',
  last_used_at timestamptz null,
  last_success_at timestamptz null,
  last_error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint shortcut_devices_name_not_blank check (char_length(trim(name)) > 0),
  constraint shortcut_devices_token_prefix_not_blank check (
    char_length(trim(token_prefix)) > 0
  ),
  constraint shortcut_devices_spoken_detail_check check (
    spoken_detail_level in ('private', 'detailed')
  )
);

create index shortcut_devices_user_id_idx on public.shortcut_devices (user_id);
create index shortcut_devices_token_hash_idx on public.shortcut_devices (token_hash);

create trigger shortcut_devices_set_updated_at
  before update on public.shortcut_devices
  for each row execute function public.set_updated_at();

alter table public.shortcut_devices enable row level security;

create policy "shortcut_devices_select_own"
  on public.shortcut_devices for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.shortcut_devices from authenticated;
revoke all on table public.shortcut_devices from anon;

-- ---------------------------------------------------------------------------
-- shortcut_command_dedup
-- ---------------------------------------------------------------------------
create table public.shortcut_command_dedup (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.shortcut_devices (id) on delete cascade,
  client_request_id text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (device_id, client_request_id)
);

create index shortcut_command_dedup_device_idx
  on public.shortcut_command_dedup (device_id, created_at desc);

alter table public.shortcut_command_dedup enable row level security;

revoke all on table public.shortcut_command_dedup from authenticated;
revoke all on table public.shortcut_command_dedup from anon;

-- ---------------------------------------------------------------------------
-- register_shortcut_device
-- ---------------------------------------------------------------------------
create or replace function public.register_shortcut_device(
  p_name text,
  p_token_hash text,
  p_token_prefix text,
  p_spoken_detail_level text default 'private'
)
returns table (
  id uuid,
  name text,
  token_prefix text,
  spoken_detail_level text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.shortcut_devices%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 120 then
    raise exception 'Invalid device name' using errcode = '22023';
  end if;

  if p_token_hash is null or char_length(p_token_hash) = 0 or char_length(p_token_hash) > 128 then
    raise exception 'Invalid token hash' using errcode = '22023';
  end if;

  if p_token_prefix is null or char_length(trim(p_token_prefix)) = 0 or char_length(p_token_prefix) > 32 then
    raise exception 'Invalid token prefix' using errcode = '22023';
  end if;

  if p_spoken_detail_level not in ('private', 'detailed') then
    raise exception 'Invalid spoken detail level' using errcode = '22023';
  end if;

  insert into public.shortcut_devices (
    user_id,
    name,
    token_hash,
    token_prefix,
    spoken_detail_level,
    is_active
  )
  values (
    v_user_id,
    trim(p_name),
    p_token_hash,
    p_token_prefix,
    p_spoken_detail_level,
    true
  )
  returning * into v_row;

  return query
  select
    v_row.id,
    v_row.name,
    v_row.token_prefix,
    v_row.spoken_detail_level,
    v_row.is_active,
    v_row.created_at;
end;
$$;

revoke all on function public.register_shortcut_device(text, text, text, text) from public;
grant execute on function public.register_shortcut_device(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- list_shortcut_devices
-- ---------------------------------------------------------------------------
create or replace function public.list_shortcut_devices()
returns table (
  id uuid,
  name text,
  token_prefix text,
  spoken_detail_level text,
  is_active boolean,
  last_used_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  created_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    sd.id,
    sd.name,
    sd.token_prefix,
    sd.spoken_detail_level,
    sd.is_active,
    sd.last_used_at,
    sd.last_success_at,
    sd.last_error_code,
    sd.created_at,
    sd.revoked_at
  from public.shortcut_devices sd
  where sd.user_id = auth.uid()
  order by sd.created_at desc;
$$;

revoke all on function public.list_shortcut_devices() from public;
grant execute on function public.list_shortcut_devices() to authenticated;

-- ---------------------------------------------------------------------------
-- rotate_shortcut_device_token
-- ---------------------------------------------------------------------------
create or replace function public.rotate_shortcut_device_token(
  p_device_id uuid,
  p_token_hash text,
  p_token_prefix text
)
returns table (
  id uuid,
  name text,
  token_prefix text,
  spoken_detail_level text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.shortcut_devices%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_token_hash is null or char_length(p_token_hash) = 0 or char_length(p_token_hash) > 128 then
    raise exception 'Invalid token hash' using errcode = '22023';
  end if;

  if p_token_prefix is null or char_length(trim(p_token_prefix)) = 0 or char_length(p_token_prefix) > 32 then
    raise exception 'Invalid token prefix' using errcode = '22023';
  end if;

  update public.shortcut_devices
  set
    token_hash = p_token_hash,
    token_prefix = p_token_prefix,
    is_active = true,
    revoked_at = null,
    last_error_code = null,
    updated_at = now()
  where id = p_device_id
    and user_id = v_user_id
    and revoked_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Shortcut device not found' using errcode = 'P0002';
  end if;

  return query
  select
    v_row.id,
    v_row.name,
    v_row.token_prefix,
    v_row.spoken_detail_level,
    v_row.is_active,
    v_row.created_at;
end;
$$;

revoke all on function public.rotate_shortcut_device_token(uuid, text, text) from public;
grant execute on function public.rotate_shortcut_device_token(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_shortcut_device
-- ---------------------------------------------------------------------------
create or replace function public.revoke_shortcut_device(p_device_id uuid)
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

  update public.shortcut_devices
  set
    is_active = false,
    revoked_at = now(),
    updated_at = now()
  where id = p_device_id
    and user_id = v_user_id;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.revoke_shortcut_device(uuid) from public;
grant execute on function public.revoke_shortcut_device(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_shortcut_device
-- ---------------------------------------------------------------------------
create or replace function public.update_shortcut_device(
  p_device_id uuid,
  p_name text,
  p_spoken_detail_level text
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

  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 120 then
    raise exception 'Invalid device name' using errcode = '22023';
  end if;

  if p_spoken_detail_level not in ('private', 'detailed') then
    raise exception 'Invalid spoken detail level' using errcode = '22023';
  end if;

  update public.shortcut_devices
  set
    name = trim(p_name),
    spoken_detail_level = p_spoken_detail_level,
    updated_at = now()
  where id = p_device_id
    and user_id = v_user_id
    and revoked_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.update_shortcut_device(uuid, text, text) from public;
grant execute on function public.update_shortcut_device(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_shortcut_device_usage (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.record_shortcut_device_usage(
  p_device_id uuid,
  p_success boolean,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shortcut_devices
  set
    last_used_at = now(),
    last_success_at = case when p_success then now() else last_success_at end,
    last_error_code = case when p_success then null else p_error_code end,
    updated_at = now()
  where id = p_device_id
    and is_active = true
    and revoked_at is null;
end;
$$;

revoke all on function public.record_shortcut_device_usage(uuid, boolean, text) from public;
grant execute on function public.record_shortcut_device_usage(uuid, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- store_shortcut_command_dedup (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.store_shortcut_command_dedup(
  p_device_id uuid,
  p_client_request_id text,
  p_response_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
begin
  if p_client_request_id is null or char_length(trim(p_client_request_id)) = 0 then
    raise exception 'Invalid client request id' using errcode = '22023';
  end if;

  select scd.response_json into v_existing
  from public.shortcut_command_dedup scd
  where scd.device_id = p_device_id
    and scd.client_request_id = p_client_request_id;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.shortcut_command_dedup (
    device_id,
    client_request_id,
    response_json
  )
  values (
    p_device_id,
    p_client_request_id,
    p_response_json
  );

  return p_response_json;
exception
  when unique_violation then
    select scd.response_json into v_existing
    from public.shortcut_command_dedup scd
    where scd.device_id = p_device_id
      and scd.client_request_id = p_client_request_id;
    return v_existing;
end;
$$;

revoke all on function public.store_shortcut_command_dedup(uuid, text, jsonb) from public;
grant execute on function public.store_shortcut_command_dedup(uuid, text, jsonb) to service_role;
