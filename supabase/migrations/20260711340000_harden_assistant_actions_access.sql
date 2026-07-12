-- Harden assistant_actions: block direct authenticated mutations.
-- Clients use SECURITY DEFINER RPC functions with ownership and state-transition checks.
-- Executed audit records are immutable and cannot be deleted by users.

-- ---------------------------------------------------------------------------
-- Revoke direct authenticated mutations on assistant_actions
-- ---------------------------------------------------------------------------
revoke insert, update, delete on table public.assistant_actions
  from authenticated;

drop policy if exists "assistant_actions_insert_own" on public.assistant_actions;
drop policy if exists "assistant_actions_update_own" on public.assistant_actions;
drop policy if exists "assistant_actions_delete_own" on public.assistant_actions;

-- SELECT remains via assistant_actions_select_own for read-only client access.

-- ---------------------------------------------------------------------------
-- Immutability trigger (defense in depth for RPC and service-role paths)
-- ---------------------------------------------------------------------------
create or replace function public.prevent_assistant_action_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'executed' then
      raise exception 'Executed assistant actions cannot be deleted'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'executed' then
      raise exception 'Executed assistant actions are immutable'
        using errcode = '42501';
    end if;

    if old.proposed_payload is distinct from new.proposed_payload
      or old.action_type is distinct from new.action_type
      or old.idempotency_key is distinct from new.idempotency_key
      or old.user_id is distinct from new.user_id
      or old.thread_id is distinct from new.thread_id
      or old.created_at is distinct from new.created_at then
      raise exception 'Immutable assistant action fields cannot be modified'
        using errcode = '42501';
    end if;

    if old.status = 'executed' then
      raise exception 'Executed assistant actions are immutable'
        using errcode = '42501';
    end if;

    if old.status in ('rejected', 'expired', 'failed')
      and new.status is distinct from old.status then
      raise exception 'Terminal assistant action status cannot change'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists assistant_actions_prevent_tampering
  on public.assistant_actions;

create trigger assistant_actions_prevent_tampering
  before update or delete on public.assistant_actions
  for each row execute function public.prevent_assistant_action_tampering();

-- ---------------------------------------------------------------------------
-- create_assistant_action
-- ---------------------------------------------------------------------------
create or replace function public.create_assistant_action(
  p_thread_id uuid,
  p_action_type text,
  p_status text,
  p_proposed_payload jsonb,
  p_source_message_id uuid default null,
  p_clarification_state jsonb default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.assistant_actions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_status not in ('awaiting_clarification', 'proposed') then
    raise exception 'Invalid initial assistant action status' using errcode = '22023';
  end if;

  if p_action_type is null or char_length(p_action_type) = 0 or char_length(p_action_type) > 100 then
    raise exception 'Invalid action type' using errcode = '22023';
  end if;

  if p_proposed_payload is null then
    raise exception 'Proposed payload is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.assistant_threads t
    where t.id = p_thread_id and t.user_id = v_user_id
  ) then
    raise exception 'Assistant thread not found' using errcode = 'P0002';
  end if;

  if p_source_message_id is not null and not exists (
    select 1 from public.assistant_messages m
    where m.id = p_source_message_id
      and m.user_id = v_user_id
      and m.thread_id = p_thread_id
  ) then
    raise exception 'Source message not found' using errcode = 'P0002';
  end if;

  insert into public.assistant_actions (
    user_id,
    thread_id,
    source_message_id,
    action_type,
    status,
    proposed_payload,
    executed_payload,
    idempotency_key,
    clarification_state,
    expires_at
  )
  values (
    v_user_id,
    p_thread_id,
    p_source_message_id,
    p_action_type,
    p_status,
    p_proposed_payload,
    null,
    gen_random_uuid()::text,
    p_clarification_state,
    coalesce(
      p_expires_at,
      now() + case
        when p_status = 'awaiting_clarification' then interval '15 minutes'
        else interval '30 minutes'
      end
    )
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_assistant_action(
  uuid, text, text, jsonb, uuid, jsonb, timestamptz
) from public;
grant execute on function public.create_assistant_action(
  uuid, text, text, jsonb, uuid, jsonb, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_assistant_action — single pending action
-- ---------------------------------------------------------------------------
create or replace function public.reject_assistant_action(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.assistant_actions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  update public.assistant_actions
  set
    status = 'rejected',
    rejected_at = now()
  where id = p_action_id
    and user_id = v_user_id
    and status in ('proposed', 'awaiting_clarification')
  returning * into v_row;

  if not found then
    select * into v_row
    from public.assistant_actions
    where id = p_action_id and user_id = v_user_id;

    if not found then
      raise exception 'Assistant action not found' using errcode = 'P0002';
    end if;

    if v_row.status = 'executed' then
      raise exception 'Executed assistant actions cannot be rejected'
        using errcode = '42501';
    end if;

    raise exception 'Assistant action is not rejectable' using errcode = '22023';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.reject_assistant_action(uuid) from public;
grant execute on function public.reject_assistant_action(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_pending_assistant_actions — bulk reject non-executed pending actions
-- ---------------------------------------------------------------------------
create or replace function public.reject_pending_assistant_actions(p_thread_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.assistant_threads t
    where t.id = p_thread_id and t.user_id = v_user_id
  ) then
    raise exception 'Assistant thread not found' using errcode = 'P0002';
  end if;

  update public.assistant_actions
  set
    status = 'rejected',
    rejected_at = now()
  where thread_id = p_thread_id
    and user_id = v_user_id
    and status in ('proposed', 'awaiting_clarification');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reject_pending_assistant_actions(uuid) from public;
grant execute on function public.reject_pending_assistant_actions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- expire_stale_assistant_actions
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_assistant_actions(p_thread_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.assistant_threads t
    where t.id = p_thread_id and t.user_id = v_user_id
  ) then
    raise exception 'Assistant thread not found' using errcode = 'P0002';
  end if;

  update public.assistant_actions
  set status = 'expired'
  where thread_id = p_thread_id
    and user_id = v_user_id
    and status in ('proposed', 'awaiting_clarification')
    and expires_at is not null
    and expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_assistant_actions(uuid) from public;
grant execute on function public.expire_stale_assistant_actions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- execute_assistant_action — idempotent proposed -> executed transition
-- ---------------------------------------------------------------------------
create or replace function public.execute_assistant_action(
  p_action_id uuid,
  p_executed_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.assistant_actions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_executed_payload is null then
    raise exception 'Executed payload is required' using errcode = '22023';
  end if;

  select * into v_row
  from public.assistant_actions
  where id = p_action_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Assistant action not found' using errcode = 'P0002';
  end if;

  if v_row.status = 'executed' then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'action', to_jsonb(v_row)
    );
  end if;

  if v_row.status <> 'proposed' then
    raise exception 'Assistant action is not confirmable' using errcode = '22023';
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    update public.assistant_actions
    set status = 'expired'
    where id = p_action_id and user_id = v_user_id;

    raise exception 'Assistant action has expired' using errcode = '22023';
  end if;

  update public.assistant_actions
  set
    status = 'executed',
    confirmed_at = now(),
    executed_at = now(),
    executed_payload = p_executed_payload
  where id = p_action_id
    and user_id = v_user_id
    and status = 'proposed'
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'action', to_jsonb(v_row)
  );
end;
$$;

revoke all on function public.execute_assistant_action(uuid, jsonb) from public;
grant execute on function public.execute_assistant_action(uuid, jsonb) to authenticated;
