import { addAppDays, getAppLocalDateKey } from "@/lib/dates/timezone";
import { listTasks } from "@/lib/data/tasks";
import { getTaskFocusScheduleSummaries } from "@/lib/data/planning";
import { toUtcFromAppLocal } from "@/lib/dates/timezone";
import type { TaskRow } from "@/types/domain";

export type RolloverMode = "change_deadline" | "schedule_work";

export type RolloverTaskPreview = {
  taskId: string;
  taskTitle: string;
  /** Alias for assistant/workflow callers */
  title: string;
  currentDueAt: string | null;
  suggestedDueAt: string;
  suggestedDateKey: string;
  remainingMinutes: number;
  unscheduledRemainingMinutes: number;
  reason: string;
  mode: RolloverMode;
  effect:
    | "Moves deadline to tomorrow"
    | "Schedules work tomorrow; keeps deadline";
};

export type RolloverPreviewResult = {
  sourceDateKey: string;
  periodEnd: string;
  mode: RolloverMode;
  previews: RolloverTaskPreview[];
};

function isUnfinishedForDate(task: TaskRow, targetDate: string): boolean {
  if (task.status === "in_progress") return true;
  if (!task.due_at) return false;
  return getAppLocalDateKey(task.due_at) === targetDate;
}

export async function previewUnfinishedRollover(
  targetDate: string,
  options?: { mode?: RolloverMode },
): Promise<RolloverPreviewResult> {
  const mode = options?.mode ?? "schedule_work";
  const tasks = await listTasks({ status: "active", sort: "due_date" });
  const unfinished = tasks.filter(
    (task) => !task.parent_task_id && isUnfinishedForDate(task, targetDate),
  );

  const suggestedDateKey = addAppDays(targetDate, 1);
  const suggestedDueAt = toUtcFromAppLocal(
    suggestedDateKey,
    "23:59",
  ).toISOString();
  const periodEnd = toUtcFromAppLocal(targetDate, "23:59").toISOString();
  const effect =
    mode === "change_deadline"
      ? ("Moves deadline to tomorrow" as const)
      : ("Schedules work tomorrow; keeps deadline" as const);

  if (unfinished.length === 0) {
    return {
      sourceDateKey: targetDate,
      periodEnd,
      mode,
      previews: [],
    };
  }

  const summaries = await getTaskFocusScheduleSummaries(unfinished);

  const previews = unfinished.map((task) => {
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
      title: task.title,
      currentDueAt: task.due_at,
      suggestedDueAt,
      suggestedDateKey,
      remainingMinutes: remaining,
      unscheduledRemainingMinutes: unscheduled,
      reason,
      mode,
      effect,
    };
  });

  return {
    sourceDateKey: targetDate,
    periodEnd,
    mode,
    previews,
  };
}
