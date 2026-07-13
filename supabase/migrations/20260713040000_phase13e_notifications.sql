-- LifeOS Phase 13E: review and workflow notification preferences

alter table public.planning_preferences
  add column morning_review_enabled boolean not null default false,
  add column morning_review_time text null default '07:00',
  add column evening_review_enabled boolean not null default false,
  add column evening_review_time text null default '20:00',
  add column weekly_review_reminder_enabled boolean not null default false,
  add column waiting_followup_enabled boolean not null default false,
  add column overdue_decision_reminder_enabled boolean not null default false,
  add column planning_feedback_reminder_enabled boolean not null default false;

alter table public.planning_preferences
  add constraint planning_preferences_morning_review_time_format check (
    morning_review_time is null or morning_review_time ~ '^\d{2}:\d{2}$'
  ),
  add constraint planning_preferences_evening_review_time_format check (
    evening_review_time is null or evening_review_time ~ '^\d{2}:\d{2}$'
  );
