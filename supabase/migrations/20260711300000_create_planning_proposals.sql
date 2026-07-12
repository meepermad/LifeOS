-- LifeOS Phase 6: planning proposals and task-linked focus blocks

-- ---------------------------------------------------------------------------
-- events.related_task_id
-- ---------------------------------------------------------------------------
alter table public.events
  add column related_task_id uuid null
  references public.tasks (id) on delete set null;

create index events_user_related_task_idx
  on public.events (user_id, related_task_id);

-- ---------------------------------------------------------------------------
-- planning_runs
-- ---------------------------------------------------------------------------
create table public.planning_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'generated',
  input_hash text not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_runs_status_check check (
    status in (
      'generated',
      'partially_accepted',
      'accepted',
      'rejected',
      'stale'
    )
  )
);

create index planning_runs_user_period_status_idx
  on public.planning_runs (user_id, period_start, period_end, status);

create index planning_runs_user_created_idx
  on public.planning_runs (user_id, created_at desc);

create trigger planning_runs_set_updated_at
  before update on public.planning_runs
  for each row execute function public.set_updated_at();

alter table public.planning_runs enable row level security;

create policy "planning_runs_select_own"
  on public.planning_runs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "planning_runs_insert_own"
  on public.planning_runs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "planning_runs_update_own"
  on public.planning_runs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "planning_runs_delete_own"
  on public.planning_runs for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.planning_runs to authenticated;
revoke all on table public.planning_runs from anon;

-- ---------------------------------------------------------------------------
-- planning_proposals
-- ---------------------------------------------------------------------------
create table public.planning_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  planning_run_id uuid not null references public.planning_runs (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  proposed_start_at timestamptz not null,
  proposed_end_at timestamptz not null,
  proposed_minutes integer not null,
  status text not null default 'pending',
  explanation jsonb not null,
  proposal_hash text not null,
  created_event_id uuid null references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz null,
  rejected_at timestamptz null,
  constraint planning_proposals_end_after_start check (
    proposed_end_at > proposed_start_at
  ),
  constraint planning_proposals_minutes_positive check (proposed_minutes > 0),
  constraint planning_proposals_duration_matches check (
    proposed_minutes = (
      extract(epoch from (proposed_end_at - proposed_start_at)) / 60
    )::integer
  ),
  constraint planning_proposals_status_check check (
    status in ('pending', 'accepted', 'rejected', 'stale', 'failed')
  ),
  constraint planning_proposals_user_hash_unique unique (user_id, proposal_hash)
);

create index planning_proposals_user_run_idx
  on public.planning_proposals (user_id, planning_run_id);

create index planning_proposals_user_task_idx
  on public.planning_proposals (user_id, task_id);

create index planning_proposals_user_status_idx
  on public.planning_proposals (user_id, status);

create index planning_proposals_user_start_idx
  on public.planning_proposals (user_id, proposed_start_at);

create trigger planning_proposals_set_updated_at
  before update on public.planning_proposals
  for each row execute function public.set_updated_at();

alter table public.planning_proposals enable row level security;

create policy "planning_proposals_select_own"
  on public.planning_proposals for select
  to authenticated
  using (auth.uid() = user_id);

create policy "planning_proposals_insert_own"
  on public.planning_proposals for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "planning_proposals_update_own"
  on public.planning_proposals for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "planning_proposals_delete_own"
  on public.planning_proposals for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.planning_proposals to authenticated;
revoke all on table public.planning_proposals from anon;

-- ---------------------------------------------------------------------------
-- accept_planning_proposal — atomic idempotent focus-block creation
-- ---------------------------------------------------------------------------
create or replace function public.accept_planning_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.planning_proposals%rowtype;
  v_run public.planning_runs%rowtype;
  v_task public.tasks%rowtype;
  v_calendar_id uuid;
  v_scheduled_minutes integer;
  v_remaining integer;
  v_overlap_count integer;
  v_event_id uuid;
  v_pending_count integer;
  v_accepted_count integer;
  v_run_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.planning_proposals
  where id = p_proposal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Proposal not found' using errcode = 'P0002';
  end if;

  if v_proposal.status = 'accepted' and v_proposal.created_event_id is not null then
    return jsonb_build_object(
      'success', true,
      'event_id', v_proposal.created_event_id,
      'idempotent', true
    );
  end if;

  if v_proposal.status <> 'pending' then
    raise exception 'Proposal is not pending' using errcode = '22023';
  end if;

  select * into v_run
  from public.planning_runs
  where id = v_proposal.planning_run_id and user_id = v_user_id;

  if not found then
    raise exception 'Planning run not found' using errcode = 'P0002';
  end if;

  if v_run.status in ('stale', 'rejected') then
    update public.planning_proposals
    set status = 'stale', updated_at = now()
    where id = v_proposal.id;

    raise exception 'Planning run is no longer active' using errcode = '22023';
  end if;

  select * into v_task
  from public.tasks
  where id = v_proposal.task_id and user_id = v_user_id;

  if not found then
    update public.planning_proposals
    set status = 'stale', updated_at = now()
    where id = v_proposal.id;

    raise exception 'Task no longer exists' using errcode = '22023';
  end if;

  if v_task.status not in ('open', 'in_progress', 'deferred') then
    update public.planning_proposals
    set status = 'stale', updated_at = now()
    where id = v_proposal.id;

    raise exception 'Task is no longer active' using errcode = '22023';
  end if;

  v_remaining := coalesce(v_task.remaining_minutes, v_task.estimated_minutes, 0);

  select coalesce(sum(
    extract(epoch from (e.end_at - e.start_at)) / 60
  )::integer, 0)
  into v_scheduled_minutes
  from public.events e
  where e.user_id = v_user_id
    and e.related_task_id = v_task.id
    and e.event_type = 'focus_block'
    and e.status = 'confirmed'
    and e.start_at >= now()
    and (v_task.due_at is null or e.start_at <= v_task.due_at);

  if v_remaining - v_scheduled_minutes < v_proposal.proposed_minutes then
    update public.planning_proposals
    set status = 'stale', updated_at = now()
    where id = v_proposal.id;

    raise exception 'Insufficient unscheduled remaining work' using errcode = '22023';
  end if;

  select count(*) into v_overlap_count
  from public.events e
  where e.user_id = v_user_id
    and e.status <> 'cancelled'
    and e.blocks_time = true
    and e.event_type <> 'deadline'
    and e.start_at < v_proposal.proposed_end_at
    and e.end_at > v_proposal.proposed_start_at;

  if v_overlap_count > 0 then
    update public.planning_proposals
    set status = 'stale', updated_at = now()
    where id = v_proposal.id;

    raise exception 'Proposed interval is no longer open' using errcode = '22023';
  end if;

  select c.id into v_calendar_id
  from public.calendars c
  where c.user_id = v_user_id
    and c.name = 'LifeOS Planning'
    and c.source = 'lifeos'
    and c.is_writable = true
  limit 1;

  if v_calendar_id is null then
    raise exception 'LifeOS Planning calendar is not available' using errcode = '22023';
  end if;

  insert into public.events (
    user_id,
    calendar_id,
    title,
    start_at,
    end_at,
    all_day,
    status,
    source,
    event_type,
    is_read_only,
    created_by_assistant,
    blocks_time,
    related_task_id
  )
  values (
    v_user_id,
    v_calendar_id,
    v_task.title,
    v_proposal.proposed_start_at,
    v_proposal.proposed_end_at,
    false,
    'confirmed',
    'lifeos',
    'focus_block',
    false,
    false,
    true,
    v_task.id
  )
  returning id into v_event_id;

  update public.planning_proposals
  set
    status = 'accepted',
    created_event_id = v_event_id,
    accepted_at = now(),
    updated_at = now()
  where id = v_proposal.id;

  select count(*) into v_pending_count
  from public.planning_proposals
  where planning_run_id = v_run.id and status = 'pending';

  select count(*) into v_accepted_count
  from public.planning_proposals
  where planning_run_id = v_run.id and status = 'accepted';

  if v_pending_count = 0 and v_accepted_count > 0 then
    v_run_status := 'accepted';
  elsif v_accepted_count > 0 then
    v_run_status := 'partially_accepted';
  else
    v_run_status := v_run.status;
  end if;

  update public.planning_runs
  set status = v_run_status, updated_at = now()
  where id = v_run.id;

  return jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'idempotent', false
  );
end;
$$;

grant execute on function public.accept_planning_proposal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_planning_proposal
-- ---------------------------------------------------------------------------
create or replace function public.reject_planning_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.planning_proposals%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.planning_proposals
  where id = p_proposal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Proposal not found' using errcode = 'P0002';
  end if;

  if v_proposal.status = 'rejected' then
    return jsonb_build_object('success', true, 'idempotent', true);
  end if;

  if v_proposal.status <> 'pending' then
    raise exception 'Proposal is not pending' using errcode = '22023';
  end if;

  update public.planning_proposals
  set
    status = 'rejected',
    rejected_at = now(),
    updated_at = now()
  where id = v_proposal.id;

  return jsonb_build_object('success', true, 'idempotent', false);
end;
$$;

grant execute on function public.reject_planning_proposal(uuid) to authenticated;
