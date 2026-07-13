import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { DatabaseError } from "@/lib/errors/app-error";
import {
  getEffectiveEstimateMinutes,
  resolveCalibration,
  type CalibrationSample,
} from "@/lib/analytics/calibration";
import type { PlanningTask } from "@/lib/planning/types";
import type { TaskRow, PlanningPreferencesRow } from "@/types/domain";

export type TaskCalibrationContext = {
  samplesByGroup: Map<string, CalibrationSample[]>;
  courseLabels: Map<string, string>;
};

export async function loadCalibrationContext(
  resetAt: string | null,
): Promise<TaskCalibrationContext> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  let query = supabase
    .from("task_completion_snapshots")
    .select(
      "task_id, final_actual_seconds, current_estimate_minutes, completed_at, is_current",
    )
    .eq("user_id", user.id)
    .eq("is_current", true);

  if (resetAt) {
    query = query.gte("completed_at", resetAt);
  }

  const { data: snapshots, error } = await query;
  if (error) {
    throw new DatabaseError("Failed to load calibration snapshots");
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, course_id, source, estimated_minutes, status, cancelled_by_sync")
    .eq("user_id", user.id);

  const { data: courses } = await supabase
    .from("courses")
    .select("id, code, name")
    .eq("user_id", user.id);

  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]));
  const courseLabels = new Map(
    (courses ?? []).map((c) => [c.id, c.code || c.name]),
  );

  const samplesByGroup = new Map<string, CalibrationSample[]>();

  for (const snap of snapshots ?? []) {
    const task = taskMap.get(snap.task_id);
    if (!task || task.cancelled_by_sync || task.status === "cancelled") continue;
    const estimate = snap.current_estimate_minutes ?? task.estimated_minutes;
    if (!estimate || estimate <= 0) continue;
    const ratio = snap.final_actual_seconds / 60 / estimate;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;

    const sample: CalibrationSample = {
      taskId: snap.task_id,
      ratio,
      completedAt: snap.completed_at,
    };

    if (task.course_id) {
      const key = `course:${task.course_id}`;
      const list = samplesByGroup.get(key) ?? [];
      list.push(sample);
      samplesByGroup.set(key, list);
    }

    const categoryKey = `category:${task.source}`;
    const catList = samplesByGroup.get(categoryKey) ?? [];
    catList.push(sample);
    samplesByGroup.set(categoryKey, catList);
  }

  return { samplesByGroup, courseLabels };
}

function groupHierarchyForTask(task: TaskRow): { level: string; key: string }[] {
  const hierarchy: { level: string; key: string }[] = [];
  if (task.course_id) {
    hierarchy.push({ level: "course", key: `course:${task.course_id}` });
  }
  hierarchy.push({ level: "category", key: `category:${task.source}` });
  hierarchy.push({ level: "domain", key: "domain:all" });
  return hierarchy;
}

export function applyCalibrationToPlanningTasks(
  tasks: TaskRow[],
  preferences: PlanningPreferencesRow,
  context: TaskCalibrationContext,
): PlanningTask[] {
  const adaptiveEnabled = preferences.adaptive_planning_enabled ?? true;

  return tasks.map((task) => {
    const base = {
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

    const hierarchy = groupHierarchyForTask(task).map((g) => ({
      level: g.level as "course" | "category" | "domain" | "course_category" | "none",
      key: g.key,
    }));

    const calibration = resolveCalibration(
      context.samplesByGroup,
      hierarchy,
      task.estimated_minutes,
    );

    const override =
      (task.planning_estimate_override as "original" | "adaptive" | null) ??
      null;

    const { effective, factor, reason } = getEffectiveEstimateMinutes({
      userEstimate: task.estimated_minutes,
      calibration,
      adaptiveEnabled,
      override,
    });

    return {
      ...base,
      effectiveEstimateMinutes: effective,
      calibrationMeta: {
        factor,
        sampleCount: calibration.sampleCount,
        reason,
        groupKey: calibration.group.key,
        groupLabel:
          task.course_id != null
            ? (context.courseLabels.get(task.course_id) ?? calibration.group.key)
            : calibration.group.key.replace("category:", ""),
      },
    };
  });
}
