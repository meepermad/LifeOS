import {
  getCurrentCompletionSnapshot,
  sumReviewedTrackedSeconds,
} from "@/lib/analytics/time-authority";
import { getTaskFocusScheduleSummaries } from "@/lib/data/planning";
import { sumTrackedSecondsForTask } from "@/lib/data/time-entries";
import type { TaskFocusScheduleSummary } from "@/lib/data/planning";
import type { TaskRow } from "@/types/domain";

export type TaskRemainingWorkBreakdown = {
  taskId: string;
  originalEstimateMinutes: number | null;
  adaptiveEstimateMinutes: number | null;
  trackedMinutes: number;
  reviewedActualMinutes: number | null;
  plannedFutureMinutes: number;
  remainingMinutes: number | null;
  unscheduledRemainingMinutes: number;
};

export async function getTaskRemainingWorkBreakdown(
  task: TaskRow,
  scheduleSummary?: TaskFocusScheduleSummary,
): Promise<TaskRemainingWorkBreakdown> {
  const [trackedSeconds, reviewedSeconds, snapshot, summaryMap] =
    await Promise.all([
      sumTrackedSecondsForTask(task.id),
      sumReviewedTrackedSeconds(task.id),
      getCurrentCompletionSnapshot(task.id),
      scheduleSummary
        ? Promise.resolve(new Map([[task.id, scheduleSummary]]))
        : getTaskFocusScheduleSummaries([task]),
    ]);

  const summary = scheduleSummary ?? summaryMap.get(task.id);
  const plannedFutureMinutes = summary?.futureScheduledFocusMinutes ?? 0;
  const unscheduledRemainingMinutes = summary?.unscheduledRemainingMinutes ?? 0;
  const remainingMinutes =
    summary?.remainingMinutes ??
    task.remaining_minutes ??
    task.estimated_minutes;

  return {
    taskId: task.id,
    originalEstimateMinutes: task.estimated_minutes,
    adaptiveEstimateMinutes: task.remaining_minutes,
    trackedMinutes: Math.round(trackedSeconds / 60),
    reviewedActualMinutes:
      snapshot != null
        ? Math.round(snapshot.final_actual_seconds / 60)
        : reviewedSeconds > 0
          ? Math.round(reviewedSeconds / 60)
          : null,
    plannedFutureMinutes,
    remainingMinutes,
    unscheduledRemainingMinutes,
  };
}

export async function getTaskRemainingWorkBreakdowns(
  tasks: TaskRow[],
): Promise<Map<string, TaskRemainingWorkBreakdown>> {
  if (tasks.length === 0) return new Map();

  const summaries = await getTaskFocusScheduleSummaries(tasks);
  const result = new Map<string, TaskRemainingWorkBreakdown>();

  await Promise.all(
    tasks.map(async (task) => {
      const breakdown = await getTaskRemainingWorkBreakdown(
        task,
        summaries.get(task.id),
      );
      result.set(task.id, breakdown);
    }),
  );

  return result;
}
