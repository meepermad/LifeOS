import type { EventWithCalendar } from "@/lib/data/events";
import type { PlanningRunWithProposals } from "@/lib/data/planning";
import type { ActiveTimerState } from "@/lib/data/time-entries";
import type { WorkloadSummary } from "@/lib/planning/types";
import type { TaskRow } from "@/types/domain";

export type ReviewType = "morning_daily" | "evening_daily" | "weekly";

export type DailyPeriod = "morning" | "evening";

export type PriorityLevel = "primary" | "secondary" | "not_today";

export type ReviewDecisionType =
  | "keep_due_date"
  | "move_due_date"
  | "schedule_tomorrow"
  | "return_to_inbox"
  | "split_task"
  | "reduce_scope"
  | "mark_waiting"
  | "cancel"
  | "confirm_priority"
  | "defer"
  | "acknowledge";

export type ReviewSessionRow = {
  id: string;
  user_id: string;
  review_type: ReviewType;
  review_date: string | null;
  review_week_start: string | null;
  started_at: string;
  completed_at: string | null;
  summary_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ReviewDecisionRow = {
  id: string;
  user_id: string;
  session_id: string;
  task_id: string | null;
  decision_type: ReviewDecisionType;
  decision_payload: Record<string, unknown> | null;
  created_at: string;
};

export type DailyPriorityRow = {
  id: string;
  user_id: string;
  priority_date: string;
  task_id: string;
  priority_rank: number;
  priority_level: PriorityLevel;
  created_at: string;
};

export type WeeklyPriorityRow = {
  id: string;
  user_id: string;
  week_start_date: string;
  task_id: string;
  priority_rank: number;
  created_at: string;
};

export type DailyPriorityWithTask = DailyPriorityRow & {
  task: Pick<TaskRow, "id" | "title" | "due_at" | "status">;
};

export type WeeklyPriorityWithTask = WeeklyPriorityRow & {
  task: Pick<TaskRow, "id" | "title" | "due_at" | "status">;
};

export type AwaitingFeedbackBlock = {
  eventId: string;
  title: string;
  startAt: string;
  endAt: string;
  taskId: string | null;
  taskTitle: string | null;
};

export type MorningReviewContext = {
  period: "morning";
  dateKey: string;
  events: EventWithCalendar[];
  dueToday: TaskRow[];
  overdue: TaskRow[];
  workload: WorkloadSummary | null;
  planningRun: PlanningRunWithProposals | null;
  inboxCount: number;
  inboxTasks: TaskRow[];
  activeTimer: ActiveTimerState | null;
  staleTimer: boolean;
  dailyPriorities: DailyPriorityWithTask[];
  session: ReviewSessionRow | null;
  completedSession: ReviewSessionRow | null;
};

export type EveningReviewContext = {
  period: "evening";
  dateKey: string;
  completedToday: TaskRow[];
  unfinished: TaskRow[];
  awaitingFeedback: AwaitingFeedbackBlock[];
  activeTimer: ActiveTimerState | null;
  inboxCount: number;
  tomorrowEvents: EventWithCalendar[];
  tomorrowFirstCommitment: EventWithCalendar | null;
  session: ReviewSessionRow | null;
  completedSession: ReviewSessionRow | null;
  priorDecisions: ReviewDecisionRow[];
};

export type WeeklyReviewContext = {
  weekStartDate: string;
  previousWeekStart: string;
  previousWeekEnd: string;
  nextWeekStart: string;
  nextWeekEnd: string;
  previousWorkload: WorkloadSummary | null;
  nextWorkload: WorkloadSummary | null;
  previousPlanningRun: PlanningRunWithProposals | null;
  nextPlanningRun: PlanningRunWithProposals | null;
  completedLastWeek: TaskRow[];
  carriedForward: TaskRow[];
  inboxTasks: TaskRow[];
  waitingTasks: TaskRow[];
  nextWeekEvents: EventWithCalendar[];
  nextWeekDeadlines: TaskRow[];
  weeklyPriorities: WeeklyPriorityWithTask[];
  session: ReviewSessionRow | null;
  completedSession: ReviewSessionRow | null;
};

export type ReviewInsight = {
  id: string;
  text: string;
};

export const MORNING_REVIEW_STEPS = [
  { id: "timer", label: "Timer" },
  { id: "overdue", label: "Overdue" },
  { id: "schedule", label: "Schedule" },
  { id: "priorities", label: "Priorities" },
  { id: "planning", label: "Planning" },
  { id: "overload", label: "Overload" },
  { id: "confirm", label: "Confirm" },
] as const;

export const EVENING_REVIEW_STEPS = [
  { id: "completed", label: "Completed" },
  { id: "unfinished", label: "Unfinished" },
  { id: "feedback", label: "Feedback" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "confirm", label: "Confirm" },
] as const;

export const WEEKLY_REVIEW_STEPS = [
  { id: "timing", label: "Timing data" },
  { id: "unfinished", label: "Unfinished work" },
  { id: "inbox", label: "Inbox" },
  { id: "waiting", label: "Waiting" },
  { id: "work", label: "Work schedule" },
  { id: "school", label: "School" },
  { id: "deadlines", label: "Deadlines" },
  { id: "priorities", label: "Priorities" },
  { id: "planning", label: "Planning" },
  { id: "confirm", label: "Confirm" },
] as const;

export type MorningReviewStepId = (typeof MORNING_REVIEW_STEPS)[number]["id"];
export type EveningReviewStepId = (typeof EVENING_REVIEW_STEPS)[number]["id"];
export type WeeklyReviewStepId = (typeof WEEKLY_REVIEW_STEPS)[number]["id"];
