-- LifeOS Phase 10: academic terms, class schedules, breaks, and agenda queries

-- ---------------------------------------------------------------------------
-- academic_terms
-- ---------------------------------------------------------------------------
create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  institution text not null default '',
  term_type text not null default 'custom',
  start_date date not null,
  end_date date not null,
  classes_start date not null,
  classes_end date not null,
  finals_start date null,
  finals_end date null,
  timezone text not null default 'America/Chicago',
  status text not null default 'draft',
  source_preset_key text null,
  source_preset_revision text null,
  source_preset_imported_at timestamptz null,
  source_metadata jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_terms_name_not_blank check (char_length(trim(name)) > 0),
  constraint academic_terms_term_type_check check (
    term_type in ('fall', 'spring', 'summer', 'custom')
  ),
  constraint academic_terms_status_check check (
    status in ('draft', 'active', 'archived')
  ),
  constraint academic_terms_dates_check check (end_date >= start_date),
  constraint academic_terms_classes_dates_check check (classes_end >= classes_start)
);

create index academic_terms_user_id_idx on public.academic_terms (user_id);
create index academic_terms_user_status_idx on public.academic_terms (user_id, status);

create trigger academic_terms_set_updated_at
  before update on public.academic_terms
  for each row execute function public.set_updated_at();

alter table public.academic_terms enable row level security;

create policy "academic_terms_select_own"
  on public.academic_terms for select
  to authenticated
  using (auth.uid() = user_id);

create policy "academic_terms_insert_own"
  on public.academic_terms for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "academic_terms_update_own"
  on public.academic_terms for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "academic_terms_delete_own"
  on public.academic_terms for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.academic_terms to authenticated;
revoke all on table public.academic_terms from anon;

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  academic_term_id uuid not null references public.academic_terms (id) on delete cascade,
  code text not null default '',
  name text not null,
  section text null,
  color text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_name_not_blank check (char_length(trim(name)) > 0)
);

create index courses_user_id_idx on public.courses (user_id);
create index courses_academic_term_id_idx on public.courses (academic_term_id);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

alter table public.courses enable row level security;

create policy "courses_select_own"
  on public.courses for select
  to authenticated
  using (auth.uid() = user_id);

create policy "courses_insert_own"
  on public.courses for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "courses_update_own"
  on public.courses for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "courses_delete_own"
  on public.courses for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.courses to authenticated;
revoke all on table public.courses from anon;

-- ---------------------------------------------------------------------------
-- class_meetings
-- ---------------------------------------------------------------------------
create table public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  days_of_week smallint[] not null,
  start_time text not null,
  end_time text not null,
  effective_start_date date not null,
  effective_end_date date not null,
  location text null,
  is_online boolean not null default false,
  timezone text not null default 'America/Chicago',
  source_canvas_uid text null,
  content_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_meetings_days_not_empty check (cardinality(days_of_week) > 0),
  constraint class_meetings_effective_dates_check check (
    effective_end_date >= effective_start_date
  ),
  constraint class_meetings_start_time_format check (
    start_time ~ '^\d{2}:\d{2}$'
  ),
  constraint class_meetings_end_time_format check (
    end_time ~ '^\d{2}:\d{2}$'
  )
);

create index class_meetings_user_id_idx on public.class_meetings (user_id);
create index class_meetings_course_id_idx on public.class_meetings (course_id);

create trigger class_meetings_set_updated_at
  before update on public.class_meetings
  for each row execute function public.set_updated_at();

alter table public.class_meetings enable row level security;

create policy "class_meetings_select_own"
  on public.class_meetings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "class_meetings_insert_own"
  on public.class_meetings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "class_meetings_update_own"
  on public.class_meetings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "class_meetings_delete_own"
  on public.class_meetings for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.class_meetings to authenticated;
revoke all on table public.class_meetings from anon;

-- ---------------------------------------------------------------------------
-- academic_exceptions
-- ---------------------------------------------------------------------------
create table public.academic_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  academic_term_id uuid not null references public.academic_terms (id) on delete cascade,
  exception_type text not null,
  start_date date not null,
  end_date date not null,
  course_id uuid null references public.courses (id) on delete cascade,
  suppresses_classes boolean not null default false,
  blocks_availability boolean not null default false,
  informational_only boolean not null default false,
  title text not null,
  notes text null,
  altered_schedule jsonb null,
  preset_key text null,
  is_user_modified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_exceptions_type_check check (
    exception_type in (
      'no_classes',
      'university_closed',
      'break',
      'finals_period',
      'class_cancelled',
      'altered_schedule',
      'custom'
    )
  ),
  constraint academic_exceptions_dates_check check (end_date >= start_date),
  constraint academic_exceptions_title_not_blank check (char_length(trim(title)) > 0)
);

create index academic_exceptions_user_id_idx on public.academic_exceptions (user_id);
create index academic_exceptions_term_id_idx on public.academic_exceptions (academic_term_id);
create index academic_exceptions_term_dates_idx on public.academic_exceptions (
  academic_term_id,
  start_date,
  end_date
);

create trigger academic_exceptions_set_updated_at
  before update on public.academic_exceptions
  for each row execute function public.set_updated_at();

alter table public.academic_exceptions enable row level security;

create policy "academic_exceptions_select_own"
  on public.academic_exceptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "academic_exceptions_insert_own"
  on public.academic_exceptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "academic_exceptions_update_own"
  on public.academic_exceptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "academic_exceptions_delete_own"
  on public.academic_exceptions for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.academic_exceptions to authenticated;
revoke all on table public.academic_exceptions from anon;

-- ---------------------------------------------------------------------------
-- assistant_parser_outcomes (anonymized telemetry)
-- ---------------------------------------------------------------------------
create table public.assistant_parser_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  normalized_intent text null,
  success boolean not null,
  clarification_reason text null,
  recognized_date_phrase text null,
  created_at timestamptz not null default now()
);

create index assistant_parser_outcomes_user_id_idx
  on public.assistant_parser_outcomes (user_id);

alter table public.assistant_parser_outcomes enable row level security;

create policy "assistant_parser_outcomes_select_own"
  on public.assistant_parser_outcomes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "assistant_parser_outcomes_insert_own"
  on public.assistant_parser_outcomes for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on table public.assistant_parser_outcomes to authenticated;
revoke all on table public.assistant_parser_outcomes from anon;

-- ---------------------------------------------------------------------------
-- events: academic source + class_meeting_id
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists class_meeting_id uuid null
    references public.class_meetings (id) on delete set null;

create index if not exists events_class_meeting_id_idx
  on public.events (class_meeting_id)
  where class_meeting_id is not null;

alter table public.events drop constraint if exists events_source_check;

alter table public.events
  add constraint events_source_check check (
    source in (
      'manual',
      'lifeos',
      'microsoft',
      'google',
      'canvas',
      'workforce_import',
      'email',
      'academic'
    )
  );

-- ---------------------------------------------------------------------------
-- School calendar for materialized class events
-- ---------------------------------------------------------------------------
insert into public.calendars (user_id, name, source, is_writable, is_visible, sync_enabled)
select
  u.id,
  'School',
  'manual',
  true,
  true,
  false
from auth.users u
where not exists (
  select 1
  from public.calendars c
  where c.user_id = u.id
    and c.name = 'School'
);
