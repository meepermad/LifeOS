import { addAppDays, getAppLocalDateKey, isOverdue, nowInAppTimezone } from "@/lib/dates/timezone";
import { getTaskFocusScheduleSummaries } from "@/lib/data/planning";
import { listTasks } from "@/lib/data/tasks";
import { getDailyPriorities, getWeeklyPriorities } from "@/lib/data/reviews";
import { getProfile } from "@/lib/data/bootstrap";
import { getWeekBounds } from "@/lib/dates/timezone";
import {
  getTaskRemainingWorkBreakdown,
  type TaskRemainingWorkBreakdown,
} from "@/lib/planning/remaining-work";
import { compareTasks } from "@/lib/planning/task-allocation";
import { toPlanningTask } from "@/lib/planning/mappers";
import { isActionableWorkload, isInboxTask } from "@/lib/tasks/triage";
import type { TaskRow } from "@/types/domain";

export type ShelfTaskFilter = {
  dueSoon?: boolean;
  overdue?: boolean;
  weeklyPriority?: boolean;
  courseId?: string | null;
  minEstimateMinutes?: number;
  maxEstimateMinutes?: number;
  includeInbox?: boolean;
};

export type ShelfEligibleTask = {
  task: TaskRow;
  breakdown: TaskRemainingWorkBreakdown;
  unscheduledRemainingMinutes: number;
  isWeeklyPriority: boolean;
};


function isDueSoon(task: TaskRow, now: Date, withinDays = 3): boolean {
  if (!task.due_at) return false;
  const dueKey = getAppLocalDateKey(task.due_at);
  const todayKey = getAppLocalDateKey(now);
  const horizonKey = addAppDays(todayKey, withinDays);
  return dueKey >= todayKey && dueKey <= horizonKey;
}

function matchesEstimateFilter(
  task: TaskRow,
  filter: ShelfTaskFilter,
): boolean {
  const estimate = task.remaining_minutes ?? task.estimated_minutes;
  if (estimate == null) return false;
  if (filter.minEstimateMinutes != null && estimate < filter.minEstimateMinutes) {
    return false;
  }
  if (filter.maxEstimateMinutes != null && estimate > filter.maxEstimateMinutes) {
    return false;
  }
  return true;
}

export function isShelfCandidate(
  task: TaskRow,
  unscheduledRemainingMinutes: number,
  now: Date,
  options?: { includeInbox?: boolean },
): boolean {
  if (task.parent_task_id) return false;
  const remaining = task.remaining_minutes ?? task.estimated_minutes;
  if (remaining == null || remaining <= 0) return false;
  if (unscheduledRemainingMinutes <= 0) return false;
  if (!options?.includeInbox && isInboxTask(task)) return false;
  if (!isActionableWorkload(task, now) && !options?.includeInbox) return false;
  if (task.workflow_state === "waiting" || task.workflow_state === "someday") {
    return false;
  }
  return true;
}

export function matchesShelfFilters(
  task: TaskRow,
  filter: ShelfTaskFilter,
  now: Date,
  options: { isWeeklyPriority: boolean },
): boolean {
  if (filter.overdue && (!task.due_at || !isOverdue(task.due_at, now))) {
    return false;
  }
  if (filter.dueSoon && !isDueSoon(task, now)) return false;
  if (filter.weeklyPriority && !options.isWeeklyPriority) return false;
  if (filter.courseId && task.course_id !== filter.courseId) return false;
  if (
    (filter.minEstimateMinutes != null || filter.maxEstimateMinutes != null) &&
    !matchesEstimateFilter(task, filter)
  ) {
    return false;
  }
  return true;
}

export async function getShelfEligibleTasks(
  filter: ShelfTaskFilter = {},
): Promise<ShelfEligibleTask[]> {
  const now = nowInAppTimezone();
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const todayKey = getAppLocalDateKey(now);
  const { start: weekStart } = getWeekBounds(now, weekStartsOn, 0);
  const weekStartKey = getAppLocalDateKey(weekStart);

  const [allTasks, dailyPriorities, weeklyPriorities] = await Promise.all([
      listTasks({ status: "active", sort: "priority" }),
      getDailyPriorities(todayKey).catch(() => []),
      getWeeklyPriorities(weekStartKey).catch(() => []),
    ]);

  const summaries = await getTaskFocusScheduleSummaries(allTasks);

  const weeklyPriorityIds = new Set(
    weeklyPriorities.map((priority) => priority.task_id),
  );
  const dailyPriorityIds = new Set(
    dailyPriorities.map((priority) => priority.task_id),
  );

  const eligible: ShelfEligibleTask[] = [];

  for (const task of allTasks) {
    const summary = summaries.get(task.id);
    const unscheduled = summary?.unscheduledRemainingMinutes ?? 0;

    if (!isShelfCandidate(task, unscheduled, now, filter)) continue;
    if (!matchesShelfFilters(task, filter, now, {
      isWeeklyPriority:
        weeklyPriorityIds.has(task.id) || dailyPriorityIds.has(task.id),
    })) {
      continue;
    }

    const breakdown = await getTaskRemainingWorkBreakdown(task, summary);

    eligible.push({
      task,
      breakdown,
      unscheduledRemainingMinutes: unscheduled,
      isWeeklyPriority:
        weeklyPriorityIds.has(task.id) || dailyPriorityIds.has(task.id),
    });
  }

  eligible.sort((a, b) =>
    compareTasks(toPlanningTask(a.task), toPlanningTask(b.task), now),
  );

  return eligible;
}
