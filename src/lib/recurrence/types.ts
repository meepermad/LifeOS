export type RecurrenceFrequency =
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export type MonthlyMode = "day_of_month" | "ordinal_weekday";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval?: number;
  byWeekday?: number[];
  monthlyMode?: MonthlyMode;
  dayOfMonth?: number;
  ordinal?: number;
  weekday?: number;
  month?: number;
  intervalDays?: number;
};

export type RecurrenceExceptionType =
  | "skipped"
  | "moved"
  | "customised"
  | "cancelled";

export type RecurrenceTemplate = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  task_category: string | null;
  course_id: string | null;
  default_estimate_minutes: number | null;
  default_priority: number;
  default_difficulty: number;
  recurrence_rule: RecurrenceRule;
  recurrence_timezone: string;
  first_occurrence_date: string;
  due_time: string | null;
  generation_horizon_days: number;
  end_date: string | null;
  occurrence_limit: number | null;
  is_active: boolean;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurrenceException = {
  id: string;
  template_id: string;
  occurrence_date: string;
  exception_type: RecurrenceExceptionType;
  moved_to_date: string | null;
  override_title: string | null;
  override_estimate_minutes: number | null;
};

export type OccurrenceDate = {
  occurrenceKey: string;
  scheduledDate: string;
  originalDate: string;
};
