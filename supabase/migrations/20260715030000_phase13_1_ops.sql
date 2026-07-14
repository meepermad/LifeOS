-- LifeOS Phase 13.1 ops: shelf client-request idempotency

create table if not exists public.planning_client_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_request_id text not null,
  proposal_id uuid null references public.planning_proposals (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint planning_client_requests_unique unique (user_id, client_request_id)
);

create index if not exists planning_client_requests_user_idx
  on public.planning_client_requests (user_id, created_at desc);

alter table public.planning_client_requests enable row level security;

create policy "planning_client_requests_select_own"
  on public.planning_client_requests for select
  to authenticated
  using (auth.uid() = user_id);

create policy "planning_client_requests_insert_own"
  on public.planning_client_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.planning_client_requests to authenticated;
revoke all on table public.planning_client_requests from anon;
