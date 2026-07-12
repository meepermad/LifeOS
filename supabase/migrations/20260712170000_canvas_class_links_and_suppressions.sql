-- Phase 10.1: Canvas class link decisions, suppressions, parser telemetry privacy

-- ---------------------------------------------------------------------------
-- canvas_class_link_decisions
-- ---------------------------------------------------------------------------
create table public.canvas_class_link_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_meeting_id uuid null references public.class_meetings (id) on delete set null,
  academic_term_id uuid not null references public.academic_terms (id) on delete cascade,
  resolution_mode text not null,
  candidate_fingerprint text not null,
  canvas_course_id text null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz null,
  constraint canvas_class_link_decisions_mode_check check (
    resolution_mode in ('link_suppress', 'link_only', 'ignored')
  )
);

create index canvas_class_link_decisions_user_id_idx
  on public.canvas_class_link_decisions (user_id);

create index canvas_class_link_decisions_term_id_idx
  on public.canvas_class_link_decisions (academic_term_id);

alter table public.canvas_class_link_decisions enable row level security;

create policy "canvas_class_link_decisions_select_own"
  on public.canvas_class_link_decisions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "canvas_class_link_decisions_insert_own"
  on public.canvas_class_link_decisions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "canvas_class_link_decisions_update_own"
  on public.canvas_class_link_decisions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on table public.canvas_class_link_decisions to authenticated;
revoke all on table public.canvas_class_link_decisions from anon;

-- ---------------------------------------------------------------------------
-- canvas_class_link_uids
-- ---------------------------------------------------------------------------
create table public.canvas_class_link_uids (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.canvas_class_link_decisions (id) on delete cascade,
  canvas_external_event_id text not null,
  created_at timestamptz not null default now(),
  constraint canvas_class_link_uids_decision_uid_unique unique (decision_id, canvas_external_event_id)
);

create index canvas_class_link_uids_decision_id_idx
  on public.canvas_class_link_uids (decision_id);

alter table public.canvas_class_link_uids enable row level security;

create policy "canvas_class_link_uids_select_own"
  on public.canvas_class_link_uids for select
  to authenticated
  using (
    exists (
      select 1 from public.canvas_class_link_decisions d
      where d.id = decision_id and d.user_id = auth.uid()
    )
  );

create policy "canvas_class_link_uids_insert_own"
  on public.canvas_class_link_uids for insert
  to authenticated
  with check (
    exists (
      select 1 from public.canvas_class_link_decisions d
      where d.id = decision_id and d.user_id = auth.uid()
    )
  );

grant select, insert on table public.canvas_class_link_uids to authenticated;
revoke all on table public.canvas_class_link_uids from anon;

-- ---------------------------------------------------------------------------
-- canvas_suppressed_occurrences
-- ---------------------------------------------------------------------------
create table public.canvas_suppressed_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_meeting_id uuid not null references public.class_meetings (id) on delete cascade,
  decision_id uuid not null references public.canvas_class_link_decisions (id) on delete cascade,
  canvas_external_event_id text not null,
  suppressed_at timestamptz not null default now(),
  reversed_at timestamptz null,
  constraint canvas_suppressed_occurrences_uid_unique unique (user_id, canvas_external_event_id)
);

create index canvas_suppressed_occurrences_user_id_idx
  on public.canvas_suppressed_occurrences (user_id);

create index canvas_suppressed_occurrences_decision_id_idx
  on public.canvas_suppressed_occurrences (decision_id);

alter table public.canvas_suppressed_occurrences enable row level security;

create policy "canvas_suppressed_occurrences_select_own"
  on public.canvas_suppressed_occurrences for select
  to authenticated
  using (auth.uid() = user_id);

create policy "canvas_suppressed_occurrences_insert_own"
  on public.canvas_suppressed_occurrences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "canvas_suppressed_occurrences_update_own"
  on public.canvas_suppressed_occurrences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on table public.canvas_suppressed_occurrences to authenticated;
revoke all on table public.canvas_suppressed_occurrences from anon;

-- ---------------------------------------------------------------------------
-- assistant_parser_outcomes privacy hardening
-- ---------------------------------------------------------------------------
alter table public.assistant_parser_outcomes
  add column if not exists date_range_kind text null,
  add column if not exists week_offset smallint null,
  add column if not exists retention_expires_at timestamptz not null default (now() + interval '90 days');

alter table public.assistant_parser_outcomes
  drop column if exists recognized_date_phrase;

create index if not exists assistant_parser_outcomes_retention_idx
  on public.assistant_parser_outcomes (retention_expires_at);

create or replace function public.purge_expired_parser_outcomes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.assistant_parser_outcomes
  where retention_expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_parser_outcomes() from public;
grant execute on function public.purge_expired_parser_outcomes() to authenticated;
