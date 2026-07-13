export type AgendaScope = "today" | "tomorrow" | "date" | "week" | "range";

export type WorkloadScope = "today" | "tomorrow" | "date" | "week" | "range";

export type DateRangeRef = {
  phrase: string;
  startDateKey: string;
  endDateKey: string;
  label: string;
};

export type PlanPeriodType = "day" | "week";

export type TimeOfDayPreference = "morning" | "afternoon" | "evening";

export type ProposalSelectionMode =
  | "all"
  | "index"
  | "indices"
  | "period_all";

export type ParsedCommand =
  | { intent: "show_agenda"; scope: AgendaScope; dateKey?: string; range?: DateRangeRef }
  | { intent: "show_workload"; scope: WorkloadScope; dateKey?: string; range?: DateRangeRef }
  | { intent: "schedule_summary"; range: DateRangeRef }
  | { intent: "show_next_class" }
  | { intent: "show_classes"; range: DateRangeRef }
  | { intent: "query_academic_period"; range: DateRangeRef; periodKind: string }
  | { intent: "show_due_items"; range: DateRangeRef }
  | {
      intent: "find_availability";
      durationMinutes: number;
      startDateKey?: string;
      endDateKey?: string;
      beforeDateKey?: string;
      timeOfDay?: TimeOfDayPreference;
      range?: DateRangeRef;
    }
  | {
      intent: "generate_plan";
      periodType: PlanPeriodType;
      weekOffset?: number;
    }
  | {
      intent: "create_event";
      title: string;
      dateKey: string;
      startTime: string;
      endTime: string;
      eventType?: string;
    }
  | {
      intent: "create_task";
      title: string;
      dueDateKey?: string;
      dueTime?: string;
      estimatedMinutes?: number;
      priority?: number;
      difficulty?: number;
      splittable?: boolean;
      minimumBlockMinutes?: number;
    }
  | { intent: "complete_task"; taskId?: string; taskTitle?: string }
  | {
      intent: "accept_proposals";
      mode: ProposalSelectionMode;
      indices?: number[];
      periodType?: PlanPeriodType;
      weekOffset?: number;
    }
  | {
      intent: "reject_proposals";
      mode: ProposalSelectionMode;
      indices?: number[];
      periodType?: PlanPeriodType;
      weekOffset?: number;
    }
  | {
      intent: "regenerate_plan";
      periodType: PlanPeriodType;
      weekOffset?: number;
    }
  | {
      intent: "show_work_schedule";
      scope: "week" | "next";
      weekOffset?: number;
    }
  | { intent: "show_work_hours"; weekOffset?: number }
  | {
      intent: "set_work_schedule";
      shifts: Array<{
        dateKey: string;
        dayLabel: string;
        isOff: boolean;
        startTime?: string;
        endTime?: string;
        isOvernight?: boolean;
      }>;
      weekOffset?: number;
    }
  | {
      intent: "add_work_shift";
      dateKey: string;
      startTime?: string;
      endTime?: string;
      isOvernight?: boolean;
    }
  | {
      intent: "update_work_shift";
      sourceDateKey: string;
      targetDateKey?: string;
      startTime?: string;
      endTime?: string;
      isOvernight?: boolean;
    }
  | { intent: "delete_work_shift"; dateKey: string }
  | {
      intent: "copy_work_schedule";
      sourceWeekOffset: number;
      targetWeekOffset: number;
    }
  | { intent: "help" }
  | { intent: "clear_chat" }
  | { intent: "start_timer"; taskTitle?: string }
  | { intent: "stop_timer" }
  | { intent: "pause_timer" }
  | { intent: "resume_timer" }
  | { intent: "log_time"; taskTitle?: string; durationMinutes?: number }
  | { intent: "show_time_spent"; range?: DateRangeRef }
  | { intent: "show_estimate_accuracy" }
  | { intent: "show_time_breakdown"; range?: DateRangeRef }
  | { intent: "show_workload_trends" }
  | { intent: "explain_planning_estimate"; taskTitle?: string }
  | { intent: "use_original_estimate"; taskTitle?: string }
  | { intent: "unknown"; raw: string };

export type PartialCommand = Partial<
  Extract<ParsedCommand, { intent: string }>
> & { intent: ParsedCommand["intent"] };

export type MissingField =
  | "duration"
  | "date"
  | "startTime"
  | "endTime"
  | "title"
  | "dueDate"
  | "taskMatch"
  | "proposalSelection"
  | "shiftDay"
  | "shiftTime"
  | "shiftConfirmation";

export type ParseSuccess = { kind: "command"; command: ParsedCommand };

export type ParseClarification = {
  kind: "clarification";
  partial: PartialCommand;
  missingField: MissingField;
  prompt: string;
};

export type ParseUnknown = { kind: "unknown"; raw: string };

export type ParseResult = ParseSuccess | ParseClarification | ParseUnknown;

export type ClarificationState = {
  intent: ParsedCommand["intent"];
  partialPayload: PartialCommand;
  missingFields: MissingField[];
  originatingMessageId: string;
  expiresAt: string;
};

export const WRITE_INTENTS = new Set([
  "create_event",
  "create_task",
  "complete_task",
  "accept_proposals",
  "reject_proposals",
  "regenerate_plan",
  "clear_chat",
  "set_work_schedule",
  "add_work_shift",
  "update_work_shift",
  "delete_work_shift",
  "copy_work_schedule",
  "start_timer",
  "stop_timer",
  "pause_timer",
  "resume_timer",
  "log_time",
  "use_original_estimate",
] as const);

export const READ_ONLY_INTENTS = new Set([
  "show_agenda",
  "show_workload",
  "schedule_summary",
  "show_next_class",
  "show_classes",
  "query_academic_period",
  "show_due_items",
  "find_availability",
  "generate_plan",
  "help",
  "show_work_schedule",
  "show_work_hours",
  "show_time_spent",
  "show_estimate_accuracy",
  "show_time_breakdown",
  "show_workload_trends",
  "explain_planning_estimate",
] as const);
