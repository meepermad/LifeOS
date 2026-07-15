import { getAppLocalDateKey } from "@/lib/dates/timezone";
import { buildAvailabilityIntervalsForDays } from "@/lib/planning/availability";
import {
  collectFocusIntervals,
  placeFocusBlock,
} from "@/lib/planning/focus-blocks";
import { computeOpenIntervalsForDay } from "@/lib/planning/open-intervals";
import { hasEnabledAvailabilityForDay } from "@/lib/planning/fixed-commitments";
import {
  getRelevantTasksForPeriod,
  getEligibleDatesForTask,
  isUnestimatedTask,
} from "@/lib/planning/task-allocation";
import { annotateSplitRecommendations } from "@/lib/planning/proposal-explanations";
import {
  getFutureConfirmedFocusMinutesForTask,
  getUnscheduledRemainingMinutes,
} from "@/lib/planning/proposal-validation";
import { subtractIntervals, toInterval } from "@/lib/planning/intervals";
import type {
  FocusBlockProposal,
  PlanningGenerationResult,
  PlanningProposalInput,
  PendingProposalInterval,
  UnschedulableTask,
} from "@/lib/planning/types";

function getReasonForTask(
  task: {
    dueAt: string | null;
    priority: number;
    isDailyPriority?: boolean;
    isWeeklyPriority?: boolean;
  },
  isOverdue: boolean,
  now: Date,
): string {
  if (isOverdue) return "overdue_high_priority";
  if (task.dueAt) {
    const hoursUntilDue =
      (new Date(task.dueAt).getTime() - now.getTime()) / 3_600_000;
    if (hoursUntilDue <= 24) return "deadline_urgency";
  }
  if (task.isDailyPriority) return "daily_priority";
  if (task.isWeeklyPriority) return "weekly_priority";
  if (task.priority <= 2) return "earliest_due_high_priority";
  return "earliest_due_high_priority";
}

export function generatePlanningProposals(
  inputs: PlanningProposalInput,
): PlanningGenerationResult {
  const warnings: string[] = [];
  const proposals: FocusBlockProposal[] = [];
  const unschedulableTasks: UnschedulableTask[] = [];
  const placedByTask = new Map<string, number>();
  const proposedMinutesByDay = new Map<string, number>();

  const relevantTasks = getRelevantTasksForPeriod({
    tasks: inputs.tasks,
    dayKeys: inputs.dayKeys,
    now: inputs.now,
    periodType: inputs.periodType,
  });

  const availabilityByDay = buildAvailabilityIntervalsForDays(
    inputs.dayKeys,
    inputs.availabilityRules,
  );

  const pendingIntervals: PendingProposalInterval[] = [
    ...inputs.pendingProposalIntervals,
    ...inputs.acceptedProposalIntervals,
  ];

  const focusEvents = inputs.events
    .filter((e) => e.eventType === "focus_block" && e.status === "confirmed")
    .map((e) => ({
      startAt: e.startAt,
      endAt: e.endAt,
      eventType: e.eventType,
      status: e.status,
    }));

  for (const task of relevantTasks) {
    if (isUnestimatedTask(task)) {
      warnings.push(`Task “${task.title}” has no estimate and was skipped.`);
      unschedulableTasks.push({
        taskId: task.id,
        taskTitle: task.title,
        unscheduledRemainingMinutes: 0,
        reason: "Missing estimate — requires an estimate or manual scheduling.",
      });
      continue;
    }

    const unscheduled = getUnscheduledRemainingMinutes(
      task,
      inputs.events,
      inputs.now,
    );

    if (unscheduled <= 0) continue;

    const eligibleDates = getEligibleDatesForTask(
      task,
      inputs.dayKeys,
      inputs.now,
    );
    if (eligibleDates.length === 0) {
      unschedulableTasks.push({
        taskId: task.id,
        taskTitle: task.title,
        unscheduledRemainingMinutes: unscheduled,
        reason: "No eligible days in this planning period.",
      });
      continue;
    }

    const scheduledBefore = getFutureConfirmedFocusMinutesForTask(
      task,
      inputs.events,
      inputs.now,
    );

    let remaining = unscheduled;
    const isOverdue = task.dueAt
      ? new Date(task.dueAt) < inputs.now
      : false;
    const reason = getReasonForTask(task, isOverdue, inputs.now);

    const datesToTry = task.splittable
      ? [...eligibleDates]
      : eligibleDates;

    if (task.splittable && task.dueAt) {
      const dueKey = getAppLocalDateKey(task.dueAt);
      datesToTry.sort((a, b) => {
        if (a === dueKey && b !== dueKey) return 1;
        if (b === dueKey && a !== dueKey) return -1;
        return a.localeCompare(b);
      });
    }

    for (const dateKey of datesToTry) {
      if (remaining <= 0) break;

      const dayBudget =
        (computeOpenIntervalsForDay({
          dateKey,
          events: inputs.events,
          availabilityIntervals: availabilityByDay.get(dateKey) ?? [],
          preferences: inputs.preferences,
          hasAvailabilityRules: hasEnabledAvailabilityForDay(
            dateKey,
            inputs.availabilityRules,
          ),
          pendingProposalIntervals: [
            ...pendingIntervals,
            ...proposals.map((p) => ({
              taskId: p.taskId,
              startAt: p.proposedStartAt,
              endAt: p.proposedEndAt,
            })),
          ],
          alreadyProposedMinutes: proposedMinutesByDay.get(dateKey) ?? 0,
        }).remainingProposalBudgetMinutes);

      if (dayBudget <= 0) continue;

      const openDay = computeOpenIntervalsForDay({
        dateKey,
        events: inputs.events,
        availabilityIntervals: availabilityByDay.get(dateKey) ?? [],
        preferences: inputs.preferences,
        hasAvailabilityRules: hasEnabledAvailabilityForDay(
          dateKey,
          inputs.availabilityRules,
        ),
        pendingProposalIntervals: [
          ...pendingIntervals,
          ...proposals.map((p) => ({
            taskId: p.taskId,
            startAt: p.proposedStartAt,
            endAt: p.proposedEndAt,
          })),
        ],
        alreadyProposedMinutes: proposedMinutesByDay.get(dateKey) ?? 0,
      });

      let workingIntervals = [...openDay.openIntervals];

      for (const placed of proposals) {
        if (getAppLocalDateKey(placed.proposedStartAt) !== dateKey) continue;
        workingIntervals = subtractIntervals(workingIntervals, [
          toInterval(placed.proposedStartAt, placed.proposedEndAt),
        ]);
      }

      const focusIntervals = collectFocusIntervals(focusEvents, [
        ...pendingIntervals.map((p) => ({
          startAt: p.startAt,
          endAt: p.endAt,
        })),
        ...proposals.map((p) => ({
          startAt: p.proposedStartAt,
          endAt: p.proposedEndAt,
        })),
      ]);

      const proposal = placeFocusBlock({
        task,
        dateKey,
        openIntervals: workingIntervals,
        focusIntervals,
        preferences: inputs.preferences,
        remainingMinutes: remaining,
        dayBudgetMinutes: dayBudget,
        scheduledBefore,
        reason,
        now: inputs.now,
      });

      if (!proposal) {
        if (!task.splittable) break;
        continue;
      }

      proposals.push(proposal);
      remaining -= proposal.proposedMinutes;
      placedByTask.set(
        task.id,
        (placedByTask.get(task.id) ?? 0) + proposal.proposedMinutes,
      );
      proposedMinutesByDay.set(
        dateKey,
        (proposedMinutesByDay.get(dateKey) ?? 0) + proposal.proposedMinutes,
      );

      if (!task.splittable) break;
    }

    if (remaining > 0) {
      const placed = placedByTask.get(task.id) ?? 0;
      if (placed === 0) {
        unschedulableTasks.push({
          taskId: task.id,
          taskTitle: task.title,
          unscheduledRemainingMinutes: unscheduled,
          reason: task.splittable
            ? "No open interval could fit the remaining work."
            : "No single interval could fit all remaining work.",
        });
      }
    }
  }

  const totalProposedMinutes = proposals.reduce(
    (sum, p) => sum + p.proposedMinutes,
    0,
  );

  const fullyScheduledTaskIds: string[] = [];
  const partiallyScheduledTaskIds: string[] = [];
  let unscheduledMinutes = 0;

  for (const task of relevantTasks) {
    const unscheduled = getUnscheduledRemainingMinutes(
      task,
      inputs.events,
      inputs.now,
    );
    if (unscheduled <= 0) continue;

    const placed = placedByTask.get(task.id) ?? 0;
    const left = unscheduled - placed;

    if (left <= 0) {
      fullyScheduledTaskIds.push(task.id);
    } else if (placed > 0) {
      partiallyScheduledTaskIds.push(task.id);
      unscheduledMinutes += left;
    } else {
      unscheduledMinutes += unscheduled;
    }
  }

  const atRiskTaskIds = relevantTasks
    .filter((task) => {
      const unscheduled = getUnscheduledRemainingMinutes(
        task,
        inputs.events,
        inputs.now,
      );
      const placed = placedByTask.get(task.id) ?? 0;
      return unscheduled - placed > 0;
    })
    .map((task) => task.id);

  return {
    proposals: annotateSplitRecommendations(proposals),
    totalProposedMinutes,
    fullyScheduledTaskIds,
    partiallyScheduledTaskIds,
    unscheduledMinutes,
    unschedulableTasks,
    warnings,
    atRiskTaskIds,
  };
}

export { getUnscheduledRemainingMinutes, getFutureConfirmedFocusMinutesForTask };
