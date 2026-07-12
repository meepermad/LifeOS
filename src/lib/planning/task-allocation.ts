import { getAppLocalDateKey, isOverdue } from "@/lib/dates/timezone";
import { addAppDays } from "@/lib/dates/timezone";
import type {
  AllocationResult,
  DayAllocation,
  PlanningTask,
  TaskAllocationEntry,
  TaskSortComponents,
} from "@/lib/planning/types";
import { ACTIVE_TASK_STATUSES } from "@/lib/planning/types";

export function getTaskWorkloadMinutes(task: PlanningTask): number | null {
  if (task.remainingMinutes != null) return task.remainingMinutes;
  if (task.estimatedMinutes != null) return task.estimatedMinutes;
  return null;
}

export function isActiveTask(task: PlanningTask): boolean {
  return ACTIVE_TASK_STATUSES.includes(task.status);
}

export function isUnestimatedTask(task: PlanningTask): boolean {
  return getTaskWorkloadMinutes(task) === null;
}

function getTaskDueDateKey(task: PlanningTask): string | null {
  if (!task.dueAt) return null;
  return getAppLocalDateKey(task.dueAt);
}

function getTaskEarliestDateKey(task: PlanningTask): string | null {
  if (!task.earliestStartAt) return null;
  return getAppLocalDateKey(task.earliestStartAt);
}

export function getTaskSortComponents(
  task: PlanningTask,
  now: Date,
): TaskSortComponents {
  const workloadMinutes = getTaskWorkloadMinutes(task) ?? 0;
  return {
    isOverdue: task.dueAt ? isOverdue(task.dueAt, now) : false,
    dueAt: task.dueAt,
    priority: task.priority,
    difficulty: task.difficulty,
    workloadMinutes,
  };
}

export function compareTasks(
  a: PlanningTask,
  b: PlanningTask,
  now: Date,
): number {
  const aSort = getTaskSortComponents(a, now);
  const bSort = getTaskSortComponents(b, now);

  if (aSort.isOverdue !== bSort.isOverdue) {
    return aSort.isOverdue ? -1 : 1;
  }

  if (aSort.dueAt && bSort.dueAt) {
    const dueDiff =
      new Date(aSort.dueAt).getTime() - new Date(bSort.dueAt).getTime();
    if (dueDiff !== 0) return dueDiff;
  } else if (aSort.dueAt && !bSort.dueAt) {
    return -1;
  } else if (!aSort.dueAt && bSort.dueAt) {
    return 1;
  }

  if (aSort.priority !== bSort.priority) {
    return aSort.priority - bSort.priority;
  }

  if (aSort.difficulty !== bSort.difficulty) {
    return bSort.difficulty - aSort.difficulty;
  }

  return bSort.workloadMinutes - aSort.workloadMinutes;
}

export function getEligibleDatesForTask(
  task: PlanningTask,
  dayKeys: string[],
): string[] {
  const earliestKey = getTaskEarliestDateKey(task);
  const dueKey = getTaskDueDateKey(task);

  return dayKeys.filter((dateKey) => {
    if (earliestKey && dateKey < earliestKey) return false;
    if (dueKey && dateKey > dueKey) return false;
    return true;
  });
}

export function getRelevantTasksForPeriod(input: {
  tasks: PlanningTask[];
  dayKeys: string[];
  now: Date;
  periodType: "day" | "week";
}): PlanningTask[] {
  const { tasks, dayKeys, now, periodType } = input;
  const activeTasks = tasks.filter(isActiveTask);
  const periodStart = dayKeys[0];
  const periodEnd = dayKeys[dayKeys.length - 1];
  const seen = new Set<string>();
  const relevant: PlanningTask[] = [];

  function addTask(task: PlanningTask) {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    relevant.push(task);
  }

  for (const task of activeTasks) {
    const dueKey = getTaskDueDateKey(task);
    const earliestKey = getTaskEarliestDateKey(task);
    const overdue = task.dueAt ? isOverdue(task.dueAt, now) : false;

    if (overdue) {
      addTask(task);
      continue;
    }

    if (periodType === "day") {
      const todayKey = dayKeys[0];
      const eligible = getEligibleDatesForTask(task, dayKeys);
      const allocatedToday = eligible.includes(todayKey);

      if (dueKey === todayKey || allocatedToday || !dueKey) {
        addTask(task);
      }
      continue;
    }

    if (dueKey && dueKey >= periodStart && dueKey <= periodEnd) {
      addTask(task);
      continue;
    }

    const eligible = getEligibleDatesForTask(task, dayKeys);
    if (eligible.length > 0) {
      const canBegin =
        !earliestKey || earliestKey <= periodEnd;
      if (canBegin) {
        addTask(task);
        continue;
      }
    }

    if (dueKey && dueKey > periodEnd) {
      const daysAfterWeek = dayKeys.length;
      const lookaheadEnd = addAppDays(periodEnd, daysAfterWeek);
      if (dueKey <= lookaheadEnd) {
        const workload = getTaskWorkloadMinutes(task);
        if (workload != null && workload > 0) {
          addTask(task);
        }
      }
    }
  }

  return relevant.sort((a, b) => compareTasks(a, b, now));
}

function allocateNonSplittableTask(
  task: PlanningTask,
  eligibleDates: string[],
  remainingCapacity: Map<string, number>,
): { allocations: Map<string, number>; unallocated: number } {
  const workload = getTaskWorkloadMinutes(task);
  if (workload === null || workload === 0) {
    return { allocations: new Map(), unallocated: workload ?? 0 };
  }

  for (const dateKey of eligibleDates) {
    const capacity = remainingCapacity.get(dateKey) ?? 0;
    if (capacity >= workload) {
      remainingCapacity.set(dateKey, capacity - workload);
      return { allocations: new Map([[dateKey, workload]]), unallocated: 0 };
    }
  }

  return { allocations: new Map(), unallocated: workload };
}

function allocateSplittableTask(
  task: PlanningTask,
  eligibleDates: string[],
  remainingCapacity: Map<string, number>,
): { allocations: Map<string, number>; unallocated: number } {
  const workload = getTaskWorkloadMinutes(task);
  if (workload === null || workload === 0) {
    return { allocations: new Map(), unallocated: workload ?? 0 };
  }

  const allocations = new Map<string, number>();
  let remaining = workload;
  const minBlock = task.minimumBlockMinutes;

  const datesWithCapacity = eligibleDates.filter(
    (dateKey) => (remainingCapacity.get(dateKey) ?? 0) >= minBlock,
  );

  if (datesWithCapacity.length === 0) {
    return { allocations, unallocated: remaining };
  }

  let dateIndex = 0;
  let safety = 0;

  while (remaining > 0 && datesWithCapacity.length > 0 && safety < 10_000) {
    safety += 1;
    const dateKey = datesWithCapacity[dateIndex % datesWithCapacity.length];
    const capacity = remainingCapacity.get(dateKey) ?? 0;

    if (capacity < minBlock) {
      dateIndex += 1;
      if (dateIndex >= datesWithCapacity.length * 2) break;
      continue;
    }

    const chunk = Math.min(
      remaining,
      Math.max(minBlock, Math.floor(capacity / 2)),
      capacity,
    );
    const actualChunk = Math.min(chunk, capacity);

    if (actualChunk < minBlock && remaining >= minBlock) {
      dateIndex += 1;
      continue;
    }

    const toAllocate =
      remaining <= minBlock ? Math.min(remaining, capacity) : actualChunk;

    if (toAllocate <= 0) {
      dateIndex += 1;
      continue;
    }

    allocations.set(dateKey, (allocations.get(dateKey) ?? 0) + toAllocate);
    remainingCapacity.set(dateKey, capacity - toAllocate);
    remaining -= toAllocate;
    dateIndex += 1;
  }

  return { allocations, unallocated: remaining };
}

export function allocateTasks(input: {
  tasks: PlanningTask[];
  dayKeys: string[];
  availableFocusByDay: Map<string, number>;
  now: Date;
  periodType: "day" | "week";
}): AllocationResult {
  const relevantTasks = getRelevantTasksForPeriod(input);
  const remainingCapacity = new Map<string, number>();

  for (const dateKey of input.dayKeys) {
    remainingCapacity.set(dateKey, input.availableFocusByDay.get(dateKey) ?? 0);
  }

  const perDayMap = new Map<string, DayAllocation>();
  for (const dateKey of input.dayKeys) {
    perDayMap.set(dateKey, { dateKey, allocatedMinutes: 0, taskEntries: [] });
  }

  const taskEntries: TaskAllocationEntry[] = [];
  const tasksAtRisk: string[] = [];
  const tasksImpossibleBeforeDeadline: string[] = [];
  let allocatedTaskMinutes = 0;
  let unallocatedTaskMinutes = 0;

  for (const task of relevantTasks) {
    const workload = getTaskWorkloadMinutes(task);
    const sortComponents = getTaskSortComponents(task, input.now);

    if (workload === null) {
      taskEntries.push({
        taskId: task.id,
        title: task.title,
        allocatedMinutes: 0,
        unallocatedMinutes: 0,
        sortComponents,
        isAtRisk: false,
        isImpossibleBeforeDeadline: false,
      });
      continue;
    }

    const eligibleDates = getEligibleDatesForTask(task, input.dayKeys);
    const { allocations, unallocated } = task.splittable
      ? allocateSplittableTask(task, eligibleDates, remainingCapacity)
      : allocateNonSplittableTask(task, eligibleDates, remainingCapacity);

    let taskAllocated = 0;
    for (const [dateKey, minutes] of allocations) {
      taskAllocated += minutes;
      const day = perDayMap.get(dateKey)!;
      day.allocatedMinutes += minutes;
      day.taskEntries.push({ taskId: task.id, minutes });
    }

    allocatedTaskMinutes += taskAllocated;
    unallocatedTaskMinutes += unallocated;

    const dueKey = getTaskDueDateKey(task);
    const isImpossible =
      unallocated > 0 && dueKey != null && dueKey <= input.dayKeys[input.dayKeys.length - 1];
    const isAtRisk = unallocated > 0 || (dueKey != null && isOverdue(task.dueAt, input.now));

    if (isAtRisk) tasksAtRisk.push(task.id);
    if (isImpossible) tasksImpossibleBeforeDeadline.push(task.id);

    taskEntries.push({
      taskId: task.id,
      title: task.title,
      allocatedMinutes: taskAllocated,
      unallocatedMinutes: unallocated,
      sortComponents,
      isAtRisk,
      isImpossibleBeforeDeadline: isImpossible,
    });
  }

  return {
    perDayAllocations: input.dayKeys.map((dateKey) => perDayMap.get(dateKey)!),
    allocatedTaskMinutes,
    unallocatedTaskMinutes,
    tasksAtRisk,
    tasksImpossibleBeforeDeadline,
    taskEntries,
  };
}
