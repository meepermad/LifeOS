import { addAppDays, getAppLocalDateKey } from "@/lib/dates/timezone";
import { listTasks } from "@/lib/data/tasks";
import { getTaskFocusScheduleSummaries } from "@/lib/data/planning";
import { toUtcFromAppLocal } from "@/lib/dates/timezone";
import type { TaskRow } from "@/types/domain";

export type RolloverTaskPreview = {
  taskId: string;
  taskTitle: string;
  currentDueAt: string | null;
  suggestedDueAt: string;
  remainingMinutes: number;
  unscheduledRemainingMinutes: number;
  reason: string;
};

function isUnfinishedForDate(task: TaskRow, targetDate: string): boolean {
  if (task.status === "in_progress") return true;
  if (!task.due_at) return false;
  return getAppLocalDateKey(task.due_at) === targetDate;
}

export async function previewUnfinishedRollover(
  targetDate: string,
): Promise<RolloverTaskPreview[]> {
  const tasks = await listTasks({ status: "active", sort: "due_date" });
  const unfinished = tasks.filter(
    (task) => !task.parent_task_id && isUnfinishedForDate(task, targetDate),
  );

  if (unfinished.length === 0) return [];

  const summaries = await getTaskFocusScheduleSummaries(unfinished);
  const suggestedDateKey = addAppDays(targetDate, 1);
  const suggestedDueAt = toUtcFromAppLocal(
    suggestedDateKey,
    "23:59",
  ).toISOString();

  return unfinished.map((task) => {
    const summary = summaries.get(task.id);
    const remaining =
      task.remaining_minutes ?? task.estimated_minutes ?? 0;
    const unscheduled = summary?.unscheduledRemainingMinutes ?? remaining;

    let reason = "Still open at end of day";
    if (task.status === "in_progress") {
      reason = "In progress but not completed";
    } else if (unscheduled > 0) {
      reason = `${unscheduled} minutes still unscheduled`;
    }

    return {
      taskId: task.id,
      taskTitle: task.title,
      currentDueAt: task.due_at,
      suggestedDueAt,
      remainingMinutes: remaining,
      unscheduledRemainingMinutes: unscheduled,
      reason,
    };
  });
}
