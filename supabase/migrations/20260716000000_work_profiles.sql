-- LifeOS Phase 14B: work profiles and multi-shift support

-- ---------------------------------------------------------------------------
-- work_profiles
-- ---------------------------------------------------------------------------
create table public.work_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  employer_name text not null,
  role_title text null,
  display_name text not null,
  default_location text null,
  default_unpaid_break_minutes integer not null default 0,
  icon_key text null,
  is_active boolean not null default true,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_profiles_employer_not_blank check (char_length(trim(employer_name)) > 0),
  constraint work_profiles_display_not_blank check (char_length(trim(display_name)) > 0),
  constraint work_profiles_break_check check (
    default_unpaid_break_minutes >= 0 and default_unpaid_break_minutes < 480
  )
);

create index work_profiles_user_id_idx on public.work_profiles (user_id);
create index work_profiles_user_active_idx on public.work_profiles (user_id, is_active)
  where archived_at is null;

create trigger work_profiles_set_updated_at
  before update on public.work_profiles
  for each row execute function public.set_updated_at();

alter table public.work_profiles enable row level security;

create policy "work_profiles_select_own"
  on public.work_profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "work_profiles_insert_own"
  on public.work_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "work_profiles_update_own"
  on public.work_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "work_profiles_delete_own"
  on public.work_profiles for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.work_profiles to authenticated;
revoke all on table public.work_profiles from anon;

-- ---------------------------------------------------------------------------
-- Nullable work_profile_id on events and templates
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists work_profile_id uuid null
    references public.work_profiles (id) on delete set null;

create index if not exists events_work_profile_id_idx
  on public.events (work_profile_id)
  where work_profile_id is not null;

alter table public.work_shift_templates
  add column if not exists work_profile_id uuid null
    references public.work_profiles (id) on delete set null;

create index if not exists work_shift_templates_work_profile_id_idx
  on public.work_shift_templates (work_profile_id)
  where work_profile_id is not null;
