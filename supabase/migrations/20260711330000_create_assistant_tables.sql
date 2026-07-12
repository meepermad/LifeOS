-- LifeOS Phase 7: deterministic planning assistant tables

-- ---------------------------------------------------------------------------
-- assistant_threads
-- ---------------------------------------------------------------------------
create table public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'LifeOS Assistant',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_threads_user_active_idx
  on public.assistant_threads (user_id, is_active);

create trigger assistant_threads_set_updated_at
  before update on public.assistant_threads
  for each row execute function public.set_updated_at();

alter table public.assistant_threads enable row level security;

create policy "assistant_threads_select_own"
  on public.assistant_threads for select
  to authenticated
  using (auth.uid() = user_id);

create policy "assistant_threads_insert_own"
  on public.assistant_threads for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "assistant_threads_update_own"
  on public.assistant_threads for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "assistant_threads_delete_own"
  on public.assistant_threads for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.assistant_threads to authenticated;
revoke all on table public.assistant_threads from anon;

-- ---------------------------------------------------------------------------
-- assistant_messages
-- ---------------------------------------------------------------------------
create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.assistant_threads (id) on delete cascade,
  role text not null,
  message_type text not null default 'text',
  content text not null,
  structured_payload jsonb,
  created_at timestamptz not null default now(),
  constraint assistant_messages_role_check check (
    role in ('user', 'assistant')
  ),
  constraint assistant_messages_message_type_check check (
    message_type in ('text', 'clarification', 'action_preview', 'action_result', 'error')
  )
);

create index assistant_messages_thread_created_idx
  on public.assistant_messages (thread_id, created_at);

create index assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at desc);

alter table public.assistant_messages enable row level security;

create policy "assistant_messages_select_own"
  on public.assistant_messages for select
  to authenticated
  using (auth.uid() = user_id);

create policy "assistant_messages_insert_own"
  on public.assistant_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "assistant_messages_update_own"
  on public.assistant_messages for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "assistant_messages_delete_own"
  on public.assistant_messages for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.assistant_messages to authenticated;
revoke all on table public.assistant_messages from anon;

-- ---------------------------------------------------------------------------
-- assistant_actions
-- ---------------------------------------------------------------------------
create table public.assistant_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.assistant_threads (id) on delete cascade,
  source_message_id uuid references public.assistant_messages (id) on delete set null,
  action_type text not null,
  status text not null,
  proposed_payload jsonb not null,
  executed_payload jsonb,
  idempotency_key text not null,
  clarification_state jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  executed_at timestamptz,
  rejected_at timestamptz,
  constraint assistant_actions_status_check check (
    status in (
      'awaiting_clarification',
      'proposed',
      'confirmed',
      'executed',
      'rejected',
      'failed',
      'expired'
    )
  ),
  constraint assistant_actions_user_idempotency_unique unique (user_id, idempotency_key)
);

create index assistant_actions_user_status_created_idx
  on public.assistant_actions (user_id, status, created_at desc);

create index assistant_actions_thread_status_idx
  on public.assistant_actions (thread_id, status);

alter table public.assistant_actions enable row level security;

create policy "assistant_actions_select_own"
  on public.assistant_actions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "assistant_actions_insert_own"
  on public.assistant_actions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "assistant_actions_update_own"
  on public.assistant_actions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "assistant_actions_delete_own"
  on public.assistant_actions for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.assistant_actions to authenticated;
revoke all on table public.assistant_actions from anon;

-- Link events to assistant actions
alter table public.events
  add constraint events_assistant_action_id_fkey
  foreign key (assistant_action_id) references public.assistant_actions (id) on delete set null;
