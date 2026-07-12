import { getAppLocalDateKey, getDayBoundsInUtc } from "@/lib/dates/timezone";
import { buildAvailabilityIntervalsForDays } from "@/lib/planning/availability";
import {
  buildAvailabilityIntervalsForDay,
  computeDayCapacity,
  getTentativeEventIds,
  hasEnabledAvailabilityForDay,
} from "@/lib/planning/fixed-commitments";
import {
  allocateTasks,
  getRelevantTasksForPeriod,
  getTaskWorkloadMinutes,
  isUnestimatedTask,
} from "@/lib/planning/task-allocation";
import {
  deriveCapacityStatus,
  derivePeriodStatus,
  formatWorkloadExplanation,
  getHighestPressureDays,
} from "@/lib/planning/summaries";
import type {
  DayWorkloadSummary,
  WorkloadInputs,
  WorkloadSummary,
} from "@/lib/planning/types";

export function calculateWorkload(inputs: WorkloadInputs): WorkloadSummary {
  const availabilityByDay = buildAvailabilityIntervalsForDays(
    inputs.dayKeys,
    inputs.availabilityRules,
  );

  const availableFocusByDay = new Map<string, number>();
  const daySummaries: DayWorkloadSummary[] = [];

  let totalFixed = 0;
  let totalRawOpen = 0;
  let totalReserved = 0;
  let totalAvailable = 0;
  let totalScheduledFocus = 0;
  let needsAvailabilityConfiguration = false;

  for (const dateKey of inputs.dayKeys) {
    const { start, end } = getDayBoundsInUtc(dateKey);
    const availabilityIntervals =
      availabilityByDay.get(dateKey) ??
      buildAvailabilityIntervalsForDay(dateKey, inputs.availabilityRules);

    const capacity = computeDayCapacity({
      dateKey,
      dayStart: start,
      dayEnd: end,
      events: inputs.events,
      availabilityIntervals,
      preferences: inputs.preferences,
      hasAvailabilityRules: hasEnabledAvailabilityForDay(
        dateKey,
        inputs.availabilityRules,
      ),
    });

    if (capacity.needsAvailabilityConfiguration) {
      needsAvailabilityConfiguration = true;
    }

    availableFocusByDay.set(dateKey, capacity.availableFocusMinutes);

    totalFixed += capacity.fixedMinutes;
    totalRawOpen += capacity.rawOpenMinutes;
    totalReserved += capacity.reservedBufferMinutes;
    totalAvailable += capacity.availableFocusMinutes;
    totalScheduledFocus += capacity.scheduledFocusMinutes;

    daySummaries.push({
      dateKey,
      ...capacity,
      recommendedTaskMinutes: 0,
      requiredTaskMinutes: 0,
      capacityRatio: null,
      status: "clear",
      hasIncompleteData: false,
    });
  }

  const allocation = allocateTasks({
    tasks: inputs.tasks,
    dayKeys: inputs.dayKeys,
    availableFocusByDay,
    now: inputs.now,
    periodType: inputs.periodType,
  });

  const relevantTasks = getRelevantTasksForPeriod({
    tasks: inputs.tasks,
    dayKeys: inputs.dayKeys,
    now: inputs.now,
    periodType: inputs.periodType,
  });

  const unestimatedTasks = relevantTasks.filter(isUnestimatedTask);
  const unestimatedTaskIds = unestimatedTasks.map((task) => task.id);

  let overdueTaskCount = 0;
  let requiredTaskMinutes = 0;

  for (const task of relevantTasks) {
    const minutes = getTaskWorkloadMinutes(task);
    if (minutes != null) {
      requiredTaskMinutes += minutes;
    }
    if (task.dueAt && new Date(task.dueAt) < inputs.now) {
      overdueTaskCount += 1;
    }
  }

  for (const daySummary of daySummaries) {
    const dayAllocation = allocation.perDayAllocations.find(
      (entry) => entry.dateKey === daySummary.dateKey,
    );
    const recommendedTaskMinutes = dayAllocation?.allocatedMinutes ?? 0;

    const dayRequired = relevantTasks
      .filter((task) => {
        if (!task.dueAt) return false;
        return getAppLocalDateKey(task.dueAt) === daySummary.dateKey;
      })
      .reduce((sum, task) => sum + (getTaskWorkloadMinutes(task) ?? 0), 0);

    const hasIncompleteData = unestimatedTasks.some((task) => {
      const eligible = inputs.dayKeys.includes(daySummary.dateKey);
      return eligible || !task.dueAt;
    });

    const capacityRatio =
      daySummary.availableFocusMinutes > 0
        ? recommendedTaskMinutes / daySummary.availableFocusMinutes
        : recommendedTaskMinutes > 0
          ? null
          : 0;

    const status = deriveCapacityStatus({
      availableFocusMinutes: daySummary.availableFocusMinutes,
      allocatedTaskMinutes: recommendedTaskMinutes,
      requiredTaskMinutes: dayRequired,
      unallocatedTaskMinutes:
        daySummary.dateKey === inputs.dayKeys[inputs.dayKeys.length - 1]
          ? allocation.unallocatedTaskMinutes
          : 0,
      hasIncompleteData,
    });

    daySummary.recommendedTaskMinutes = recommendedTaskMinutes;
    daySummary.requiredTaskMinutes = dayRequired;
    daySummary.capacityRatio = capacityRatio;
    daySummary.status = status;
    daySummary.hasIncompleteData = hasIncompleteData && unestimatedTasks.length > 0;
  }

  const hasIncompleteData = unestimatedTasks.length > 0;
  const capacityRatio =
    totalAvailable > 0
      ? allocation.allocatedTaskMinutes / totalAvailable
      : allocation.allocatedTaskMinutes > 0
        ? null
        : 0;

  const status = derivePeriodStatus({
    availableFocusMinutes: totalAvailable,
    allocatedTaskMinutes: allocation.allocatedTaskMinutes,
    requiredTaskMinutes,
    unallocatedTaskMinutes: allocation.unallocatedTaskMinutes,
    hasIncompleteData,
  });

  const highestPressureDays = getHighestPressureDays(daySummaries);

  const explanation = formatWorkloadExplanation({
    needsAvailabilityConfiguration,
    hasIncompleteData,
    unestimatedTaskCount: unestimatedTasks.length,
    tentativeEventCount: getTentativeEventIds(inputs.events).length,
    planningBufferPercent: inputs.preferences.planningBufferPercent,
    travelBufferMinutes: inputs.preferences.travelBufferMinutes,
  });

  return {
    periodType: inputs.periodType,
    periodStart: inputs.periodStart.toISOString(),
    periodEnd: inputs.periodEnd.toISOString(),
    fixedMinutes: totalFixed,
    rawOpenMinutes: totalRawOpen,
    reservedBufferMinutes: totalReserved,
    availableFocusMinutes: totalAvailable,
    requiredTaskMinutes,
    allocatedTaskMinutes: allocation.allocatedTaskMinutes,
    unallocatedTaskMinutes: allocation.unallocatedTaskMinutes,
    scheduledFocusMinutes: totalScheduledFocus,
    unestimatedTaskCount: unestimatedTasks.length,
    overdueTaskCount,
    capacityRatio,
    status,
    hasIncompleteData,
    needsAvailabilityConfiguration,
    daySummaries,
    allocation,
    tentativeEventIds: getTentativeEventIds(inputs.events),
    unestimatedTaskIds,
    highestPressureDays,
    explanation,
  };
}
