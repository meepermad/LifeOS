-- LifeOS Phase 12A: calendar preferences on planning_preferences

alter table public.planning_preferences
  add column calendar_desktop_view text not null default 'week',
  add column calendar_mobile_view text not null default 'threeDay',
  add column calendar_visible_start_hour integer not null default 7,
  add column calendar_visible_end_hour integer not null default 22,
  add column calendar_filter_prefs jsonb not null default '{}'::jsonb;

alter table public.planning_preferences
  add constraint planning_calendar_desktop_view_check check (
    calendar_desktop_view in ('month', 'week', 'threeDay', 'day', 'agenda')
  );

alter table public.planning_preferences
  add constraint planning_calendar_mobile_view_check check (
    calendar_mobile_view in ('month', 'week', 'threeDay', 'day', 'agenda')
  );

alter table public.planning_preferences
  add constraint planning_calendar_visible_hours_check check (
    calendar_visible_start_hour between 0 and 23
    and calendar_visible_end_hour between 1 and 24
    and calendar_visible_end_hour > calendar_visible_start_hour
  );
