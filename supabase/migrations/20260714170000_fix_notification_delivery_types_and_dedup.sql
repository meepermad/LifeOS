-- Expand notification_deliveries type check for Phase 13E workflow/reminder types.
-- Deduplication remains unique(deduplication_key). Application reclaim treats
-- status IN ('failed', 'skipped') as retryable so premature "Stale delivery window"
-- rows cannot permanently poison a logical occurrence.

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_type_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_type_check check (
    notification_type in (
      'test',
      'daily_agenda',
      'weekly_summary',
      'deadline_warning',
      'overload_warning',
      'stale_timer',
      'morning_review',
      'evening_review',
      'weekly_review',
      'waiting_followup',
      'overdue_decision',
      'planning_feedback'
    )
  );

comment on column public.notification_deliveries.scheduled_for is
  'Resolved UTC instant for the logical occurrence (local wall-clock + user timezone for timed prefs; absolute timestamptz for event-driven types). Not the processor clock time.';

comment on column public.notification_deliveries.status is
  'pending/sending/sent/partial suppress duplicates. failed and skipped are reclaimable for the same deduplication_key. Stale/not_due_yet evaluations must not insert rows.';
