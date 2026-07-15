import {
  getCurrentCompletionSnapshot,
  sumReviewedTrackedSeconds,
} from "@/lib/analytics/time-authority";
import { getTaskFocusScheduleSummaries } from "@/lib/data/planning";
import { sumTrackedSecondsForTask } from "@/lib/data/time-entries";
import type { TaskFocusScheduleSummary } from "@/lib/data/planning";
import { buildRemainingWorkBreakdown } from "@/lib/planning/remaining-work-math";
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
  const trackedMinutes = Math.round(trackedSeconds / 60);

  const pure = buildRemainingWorkBreakdown({
    task: {
      estimatedMinutes: task.estimated_minutes,
      effectiveEstimateMinutes: null,
      remainingMinutes: task.remaining_minutes,
      trackedMinutes,
    },
    plannedFutureMinutes,
  });

  return {
    taskId: task.id,
    originalEstimateMinutes: pure.originalEstimateMinutes,
    adaptiveEstimateMinutes: pure.adaptiveEstimateMinutes,
    trackedMinutes: pure.trackedMinutes,
    reviewedActualMinutes:
      snapshot != null
        ? Math.round(snapshot.final_actual_seconds / 60)
        : reviewedSeconds > 0
          ? Math.round(reviewedSeconds / 60)
          : null,
    plannedFutureMinutes: pure.plannedFutureMinutes,
    remainingMinutes: pure.remainingWorkMinutes,
    unscheduledRemainingMinutes:
      summary?.unscheduledRemainingMinutes ??
      pure.unscheduledRemainingMinutes,
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
