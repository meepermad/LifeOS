export const ALLOWED_READ_INTENTS = [
  "schedule_summary",
  "show_agenda",
  "show_workload",
  "show_due_items",
  "find_availability",
  "show_classes",
  "show_next_class",
  "query_academic_period",
  "show_work_schedule",
  "show_work_hours",
  "show_inbox",
  "start_morning_review",
  "start_weekly_review",
  "help_plan_today",
  "show_pending_decisions",
  "show_recurring_tasks",
  "find_time_unscheduled",
  "show_awaiting_feedback",
] as const;

export const ALLOWED_WRITE_INTENTS = [
  "create_event",
  "create_task",
  "add_work_shift",
  "update_work_shift",
  "delete_work_shift",
  "create_inbox_task",
  "defer_task",
  "mark_waiting",
  "create_recurring_task",
  "skip_recurrence_occurrence",
  "pause_recurring_task",
  "preview_rollover",
  "keep_task_overdue",
] as const;

export const ALLOWED_META_INTENTS = ["unsupported"] as const;

export const ALLOWED_INTENTS = [
  ...ALLOWED_READ_INTENTS,
  ...ALLOWED_WRITE_INTENTS,
] as const;

export type AllowedIntent = (typeof ALLOWED_INTENTS)[number];

export const ALLOWED_RANGE_KINDS = [
  "day",
  "week",
  "calendar_week",
  "month",
  "rolling",
  "academic",
  "explicit",
  "weekend",
] as const;

export type AllowedRangeKind = (typeof ALLOWED_RANGE_KINDS)[number];

export function getAllowlistForPrompt(): {
  allowedIntents: readonly string[];
  allowedRangeKinds: readonly string[];
} {
  return {
    allowedIntents: ALLOWED_INTENTS,
    allowedRangeKinds: ALLOWED_RANGE_KINDS,
  };
}

const CONFIRMATION_PATTERNS = [
  /^\s*(yes|yeah|yep|confirm|ok|okay|do it|go ahead)\s*$/i,
  /^\s*(no|nope|cancel|stop|nevermind|never mind)\s*$/i,
];

export function isConfirmationOrCancellationMessage(text: string): boolean {
  return CONFIRMATION_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

export function isClearlyUnsupportedMessage(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return true;
  if (/^(hi|hello|hey|thanks|thank you)\b/.test(lower)) return true;
  if (/\b(email|password|sql|database|supabase|hack)\b/.test(lower)) return true;
  return false;
}
