import type { Database } from "@/types/database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ConnectionRow = Database["public"]["Tables"]["connections"]["Row"];
export type WorkflowState = "actionable" | "waiting" | "someday" | "backlog";
export type SyncStateRow = Database["public"]["Tables"]["sync_states"]["Row"];
export type CalendarRow = Database["public"]["Tables"]["calendars"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
export type TaskRow = Omit<
  Database["public"]["Tables"]["tasks"]["Row"],
  | "planning_estimate_override"
  | "course_id"
  | "workflow_state"
  | "inbox_at"
  | "waiting_reason"
  | "waiting_follow_up_at"
  | "deferred_until_at"
  | "recurrence_template_id"
  | "recurrence_occurrence_key"
  | "parent_task_id"
  | "is_manually_customized"
  | "manually_detached_from_recurrence"
> & {
  planning_estimate_override?: string | null;
  course_id?: string | null;
  workflow_state?: string;
  inbox_at?: string | null;
  waiting_reason?: string | null;
  waiting_follow_up_at?: string | null;
  deferred_until_at?: string | null;
  recurrence_template_id?: string | null;
  recurrence_occurrence_key?: string | null;
  parent_task_id?: string | null;
  is_manually_customized?: boolean;
  manually_detached_from_recurrence?: boolean;
};
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type AvailabilityRuleRow =
  Database["public"]["Tables"]["availability_rules"]["Row"];
export type PlanningPreferencesRow =
  Database["public"]["Tables"]["planning_preferences"]["Row"] & {
    morning_review_enabled?: boolean;
    morning_review_time?: string | null;
    evening_review_enabled?: boolean;
    evening_review_time?: string | null;
    weekly_review_reminder_enabled?: boolean;
    waiting_followup_enabled?: boolean;
    overdue_decision_reminder_enabled?: boolean;
    planning_feedback_reminder_enabled?: boolean;
  };

export type ConnectionProvider = "canvas_ics" | "microsoft";
export type ConnectionStatus =
  | "disconnected"
  | "connected"
  | "syncing"
  | "error";
export type CalendarSource =
  | "manual"
  | "lifeos"
  | "workforce_import"
  | "canvas"
  | "microsoft";
export type EventStatus = "tentative" | "confirmed" | "cancelled";
export type EventSource =
  | "manual"
  | "lifeos"
  | "microsoft"
  | "google"
  | "canvas"
  | "workforce_import"
  | "email"
  | "academic";
export type EventType =
  | "class"
  | "work"
  | "meeting"
  | "appointment"
  | "deadline"
  | "focus_block"
  | "travel"
  | "personal"
  | "meal"
  | "exercise"
  | "other";
export type TaskSource =
  | "manual"
  | "canvas"
  | "microsoft"
  | "google"
  | "email"
  | "assistant";
export type TaskStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "deferred";

export type WorkloadSnapshotRow =
  Database["public"]["Tables"]["workload_snapshots"]["Row"];

export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];

export type NotificationDeliveryRow =
  Database["public"]["Tables"]["notification_deliveries"]["Row"];

export type NotificationType =
  | "test"
  | "daily_agenda"
  | "weekly_summary"
  | "deadline_warning"
  | "overload_warning"
  | "stale_timer"
  | "morning_review"
  | "evening_review"
  | "weekly_review"
  | "waiting_followup"
  | "overdue_decision"
  | "planning_feedback";

export type NotificationDeliveryStatus =
  | "pending"
  | "sending"
  | "sent"
  | "partial"
  | "failed"
  | "skipped";

export type NotificationPrivacyMode = "private" | "detailed";

export type WorkloadPeriodType = "day" | "week";

export type WorkloadStatus =
  | "clear"
  | "manageable"
  | "heavy"
  | "overloaded"
  | "no_capacity"
  | "incomplete_data";

export type PlanningRunRow =
  Database["public"]["Tables"]["planning_runs"]["Row"];
export type PlanningProposalRow =
  Database["public"]["Tables"]["planning_proposals"]["Row"];

export type PlanningRunStatus =
  | "generated"
  | "partially_accepted"
  | "accepted"
  | "rejected"
  | "stale";

export type PlanningProposalStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "stale"
  | "failed";

export type AssistantThreadRow =
  Database["public"]["Tables"]["assistant_threads"]["Row"];
export type AssistantMessageRow =
  Database["public"]["Tables"]["assistant_messages"]["Row"];
export type AssistantActionRow =
  Database["public"]["Tables"]["assistant_actions"]["Row"];

export type AssistantMessageRole = "user" | "assistant";
export type AssistantMessageType =
  | "text"
  | "clarification"
  | "action_preview"
  | "action_result"
  | "error";

export type AssistantActionStatus =
  | "awaiting_clarification"
  | "proposed"
  | "confirmed"
  | "executed"
  | "rejected"
  | "failed"
  | "expired";

export type WorkShiftTemplateRow =
  Database["public"]["Tables"]["work_shift_templates"]["Row"];
export type WorkProfileRow = Database["public"]["Tables"]["work_profiles"]["Row"];

export type ShortcutDeviceRow =
  Database["public"]["Tables"]["shortcut_devices"]["Row"];

export type SpokenDetailLevel = "private" | "detailed";

export type AcademicTermRow =
  Database["public"]["Tables"]["academic_terms"]["Row"];
export type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
export type ClassMeetingRow =
  Database["public"]["Tables"]["class_meetings"]["Row"];
export type AcademicExceptionRow =
  Database["public"]["Tables"]["academic_exceptions"]["Row"];
export type AssistantParserOutcomeRow =
  Database["public"]["Tables"]["assistant_parser_outcomes"]["Row"];

export type AcademicTermType = "fall" | "spring" | "summer" | "custom";
export type AcademicTermStatus = "draft" | "active" | "archived";
export type AcademicExceptionType =
  | "no_classes"
  | "university_closed"
  | "break"
  | "finals_period"
  | "class_cancelled"
  | "altered_schedule"
  | "custom";
