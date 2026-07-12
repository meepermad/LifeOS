export type AgendaScope = "today" | "tomorrow" | "date" | "week";

export type WorkloadScope = "today" | "tomorrow" | "date" | "week";

export type PlanPeriodType = "day" | "week";

export type TimeOfDayPreference = "morning" | "afternoon" | "evening";

export type ProposalSelectionMode =
  | "all"
  | "index"
  | "indices"
  | "period_all";

export type ParsedCommand =
  | { intent: "show_agenda"; scope: AgendaScope; dateKey?: string }
  | { intent: "show_workload"; scope: WorkloadScope; dateKey?: string }
  | {
      intent: "find_availability";
      durationMinutes: number;
      startDateKey?: string;
      endDateKey?: string;
      beforeDateKey?: string;
      timeOfDay?: TimeOfDayPreference;
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
  | { intent: "help" }
  | { intent: "clear_chat" }
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
  | "proposalSelection";

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
] as const);

export const READ_ONLY_INTENTS = new Set([
  "show_agenda",
  "show_workload",
  "find_availability",
  "generate_plan",
  "help",
] as const);
