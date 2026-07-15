import { toUtcFromAppLocal } from "@/lib/dates/timezone";
import type {
  PlanningEvent,
  PlanningPreferences,
  PlanningProposalInput,
  PlanningTask,
  PendingProposalInterval,
} from "@/lib/planning/types";
import type {
  PlannerEventFixture,
  PlannerScenario,
  PlannerTaskFixture,
} from "./types";

export function chicago(dateKey: string, time: string): string {
  return toUtcFromAppLocal(dateKey, time).toISOString();
}

const DEFAULT_PREFERENCES: PlanningPreferences = {
  minimumBreakMinutes: 15,
  travelBufferMinutes: 0,
  planningBufferPercent: 0,
  preferredFocusBlockMinutes: 60,
  maximumFocusBlockMinutes: 120,
  avoidDifficultWorkAfter: null,
};

function mapTask(fixture: PlannerTaskFixture): PlanningTask {
  const estimatedMinutes =
    "estimatedMinutes" in fixture ? fixture.estimatedMinutes! : 60;
  const remainingMinutes =
    "remainingMinutes" in fixture
      ? fixture.remainingMinutes!
      : estimatedMinutes;

  return {
    id: fixture.id,
    title: fixture.title ?? fixture.id,
    status: (fixture.status ?? "open") as PlanningTask["status"],
    dueAt: fixture.dueAt ?? null,
    earliestStartAt: fixture.earliestStartAt ?? null,
    estimatedMinutes,
    remainingMinutes,
    trackedMinutes: fixture.trackedMinutes,
    effectiveEstimateMinutes: fixture.effectiveEstimateMinutes,
    calibrationMeta: fixture.calibrationMeta,
    priority: fixture.priority ?? 3,
    difficulty: fixture.difficulty ?? 3,
    splittable: fixture.splittable ?? true,
    minimumBlockMinutes: fixture.minimumBlockMinutes ?? 25,
    source: fixture.source ?? "manual",
    relatedEventId: null,
    workflowState: fixture.workflowState ?? "actionable",
    deferredUntilAt: fixture.deferredUntilAt ?? null,
    inboxAt: fixture.inboxAt ?? null,
    parentTaskId: fixture.parentTaskId ?? null,
    isRecurrenceTemplate: fixture.isRecurrenceTemplate ?? false,
    isDailyPriority: fixture.isDailyPriority ?? false,
    isWeeklyPriority: fixture.isWeeklyPriority ?? false,
  };
}

function mapEvent(fixture: PlannerEventFixture): PlanningEvent {
  return {
    id: fixture.id,
    title: fixture.title ?? fixture.id,
    startAt: fixture.startAt,
    endAt: fixture.endAt,
    allDay: fixture.allDay ?? false,
    status: (fixture.status ?? "confirmed") as PlanningEvent["status"],
    eventType: (fixture.eventType ?? "meeting") as PlanningEvent["eventType"],
    blocksTime: fixture.blocksTime ?? true,
    source: fixture.source ?? "manual",
    relatedTaskId: fixture.relatedTaskId ?? null,
  };
}

function focusBlockFromAccepted(
  block: PendingProposalInterval,
  index: number,
): PlanningEvent {
  return {
    id: `accepted-focus-${block.taskId}-${index}`,
    title: "Accepted focus block",
    startAt: block.startAt,
    endAt: block.endAt,
    allDay: false,
    status: "confirmed",
    eventType: "focus_block",
    blocksTime: true,
    source: "planning",
    relatedTaskId: block.taskId,
  };
}

/** Convert a benchmark scenario into production planner input. */
export function buildPlanningInput(scenario: PlannerScenario): PlanningProposalInput {
  const events: PlanningEvent[] = scenario.fixedEvents.map(mapEvent);
  const acceptedProposalIntervals: PendingProposalInterval[] = [];
  const pendingProposalIntervals: PendingProposalInterval[] = [];

  for (const [index, block] of (scenario.existingPlanningBlocks ?? []).entries()) {
    const interval: PendingProposalInterval = {
      taskId: block.taskId,
      startAt: block.startAt,
      endAt: block.endAt,
    };

    if (block.accepted) {
      acceptedProposalIntervals.push(interval);
      events.push(focusBlockFromAccepted(interval, index));
    } else {
      pendingProposalIntervals.push(interval);
    }
  }

  const preferences: PlanningPreferences = {
    ...DEFAULT_PREFERENCES,
    ...scenario.preferences,
    travelBufferMinutes:
      scenario.preferences.travelBufferMinutes ?? DEFAULT_PREFERENCES.travelBufferMinutes,
    planningBufferPercent:
      scenario.preferences.planningBufferPercent ??
      DEFAULT_PREFERENCES.planningBufferPercent,
  };

  return {
    events,
    tasks: scenario.tasks.map(mapTask),
    availabilityRules: scenario.availabilityRules.map((rule) => ({
      dayOfWeek: rule.dayOfWeek,
      availableStart: rule.availableStart,
      availableEnd: rule.availableEnd,
      isEnabled: rule.isEnabled ?? true,
    })),
    preferences,
    weekStartsOn: scenario.weekStartsOn ?? 1,
    now: new Date(scenario.now),
    periodType: scenario.periodType,
    periodStart: new Date(scenario.rangeStart),
    periodEnd: new Date(scenario.rangeEnd),
    dayKeys: scenario.dayKeys,
    pendingProposalIntervals,
    acceptedProposalIntervals,
  };
}
