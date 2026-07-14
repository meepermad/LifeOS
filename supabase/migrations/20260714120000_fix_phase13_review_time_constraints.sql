-- Repair Phase 13E review-time check constraints.
-- normalizeOptionalTime stores HH:MM:SS; the original checks only allowed HH:MM,
-- causing notification preference updates to fail with a check_violation.

alter table public.planning_preferences
  drop constraint if exists planning_preferences_morning_review_time_format;

alter table public.planning_preferences
  drop constraint if exists planning_preferences_evening_review_time_format;

alter table public.planning_preferences
  add constraint planning_preferences_morning_review_time_format check (
    morning_review_time is null
    or morning_review_time ~ '^\d{2}:\d{2}(:\d{2})?$'
  ),
  add constraint planning_preferences_evening_review_time_format check (
    evening_review_time is null
    or evening_review_time ~ '^\d{2}:\d{2}(:\d{2})?$'
  );
