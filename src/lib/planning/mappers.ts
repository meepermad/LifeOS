import type { EventRow, TaskRow } from "@/types/domain";
import type {
  PlanningAvailabilityRule,
  PlanningEvent,
  PlanningPreferences,
  PlanningProposalInput,
  PlanningTask,
  WorkloadInputs,
} from "@/lib/planning/types";
import type { AvailabilityRuleRow, PlanningPreferencesRow } from "@/types/domain";

export function toPlanningEvent(event: EventRow): PlanningEvent {
  return {
    id: event.id,
    title: event.title,
    startAt: event.start_at,
    endAt: event.end_at,
    allDay: event.all_day,
    status: event.status as PlanningEvent["status"],
    eventType: event.event_type as PlanningEvent["eventType"],
    blocksTime: event.blocks_time,
    source: event.source,
    relatedTaskId: event.related_task_id,
  };
}

export function toPlanningTask(task: TaskRow): PlanningTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status as PlanningTask["status"],
    dueAt: task.due_at,
    earliestStartAt: task.earliest_start_at,
    estimatedMinutes: task.estimated_minutes,
    remainingMinutes: task.remaining_minutes,
    priority: task.priority,
    difficulty: task.difficulty,
    splittable: task.splittable,
    minimumBlockMinutes: task.minimum_block_minutes,
    source: task.source,
    relatedEventId: task.related_event_id,
  };
}

export function toPlanningAvailabilityRule(
  rule: AvailabilityRuleRow,
): PlanningAvailabilityRule {
  return {
    dayOfWeek: rule.day_of_week,
    availableStart: rule.available_start,
    availableEnd: rule.available_end,
    isEnabled: rule.is_enabled,
  };
}

export function toPlanningPreferences(
  preferences: PlanningPreferencesRow,
): PlanningPreferences {
  return {
    minimumBreakMinutes: preferences.minimum_break_minutes,
    travelBufferMinutes: preferences.travel_buffer_minutes,
    planningBufferPercent: preferences.planning_buffer_percent,
    preferredFocusBlockMinutes: preferences.preferred_focus_block_minutes,
    maximumFocusBlockMinutes: preferences.maximum_focus_block_minutes,
    avoidDifficultWorkAfter: preferences.avoid_difficult_work_after,
  };
}

export function buildWorkloadInputs(input: {
  events: EventRow[];
  tasks: TaskRow[];
  availabilityRules: AvailabilityRuleRow[];
  preferences: PlanningPreferencesRow;
  weekStartsOn: 0 | 1;
  now: Date;
  periodType: "day" | "week";
  periodStart: Date;
  periodEnd: Date;
  dayKeys: string[];
}): WorkloadInputs {
  return {
    events: input.events.map(toPlanningEvent),
    tasks: input.tasks.map(toPlanningTask),
    availabilityRules: input.availabilityRules.map(toPlanningAvailabilityRule),
    preferences: toPlanningPreferences(input.preferences),
    weekStartsOn: input.weekStartsOn,
    now: input.now,
    periodType: input.periodType,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dayKeys: input.dayKeys,
  };
}

export function buildProposalInputs(input: {
  events: EventRow[];
  tasks: TaskRow[];
  availabilityRules: AvailabilityRuleRow[];
  preferences: PlanningPreferencesRow;
  weekStartsOn: 0 | 1;
  now: Date;
  periodType: "day" | "week";
  periodStart: Date;
  periodEnd: Date;
  dayKeys: string[];
  pendingProposalIntervals?: PlanningProposalInput["pendingProposalIntervals"];
  acceptedProposalIntervals?: PlanningProposalInput["acceptedProposalIntervals"];
}): PlanningProposalInput {
  return {
    events: input.events.map(toPlanningEvent),
    tasks: input.tasks.map(toPlanningTask),
    availabilityRules: input.availabilityRules.map(toPlanningAvailabilityRule),
    preferences: toPlanningPreferences(input.preferences),
    weekStartsOn: input.weekStartsOn,
    now: input.now,
    periodType: input.periodType,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dayKeys: input.dayKeys,
    pendingProposalIntervals: input.pendingProposalIntervals ?? [],
    acceptedProposalIntervals: input.acceptedProposalIntervals ?? [],
  };
}

export function defaultBlocksTimeForEventType(eventType: string): boolean {
  return eventType !== "deadline";
}
