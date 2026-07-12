import { cache } from "react";
import { getProfile } from "@/lib/data/bootstrap";
import { listAvailabilityRules } from "@/lib/data/availability";
import { listEventsInRange } from "@/lib/data/events";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { listTasks } from "@/lib/data/tasks";
import {
  addAppDays,
  getTodayBoundsUtc,
  getWeekBounds,
  getWeekDayKeys,
  getAppLocalDateKey,
  nowInAppTimezone,
  toUtcEndOfAppLocalDay,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { computeWorkloadInputHash } from "@/lib/planning/input-hash";
import { buildWorkloadInputs } from "@/lib/planning/mappers";
import { calculateWorkload } from "@/lib/planning/workload";
import type { WorkloadPeriodType, WorkloadSummary } from "@/lib/planning/types";
import type { EventRow, TaskRow } from "@/types/domain";

export type WorkloadPeriodRequest = {
  periodType: WorkloadPeriodType;
  weekOffset?: number;
  startDateKey?: string;
  endDateKey?: string;
};

async function fetchEventsForWorkload(
  periodStart: Date,
  periodEnd: Date,
): Promise<EventRow[]> {
  const events = await listEventsInRange(
    periodStart.toISOString(),
    periodEnd.toISOString(),
  );
  return events;
}

async function fetchActiveTasks(): Promise<TaskRow[]> {
  return listTasks({ status: "active", sort: "due_date" });
}

export async function listCanvasTasksNeedingEstimates(
  periodStart: string,
  periodEnd: string,
): Promise<
  Array<{
    id: string;
    title: string;
    due_at: string | null;
    related_event_id: string | null;
  }>
> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_at, related_event_id")
    .eq("user_id", user.id)
    .eq("source", "canvas")
    .in("status", ["open", "in_progress", "deferred"])
    .is("estimated_minutes", null)
    .is("remaining_minutes", null)
    .gte("due_at", periodStart)
    .lte("due_at", periodEnd);

  if (error) {
    throw new DatabaseError("Failed to load Canvas tasks needing estimates");
  }

  return data ?? [];
}

/** @deprecated Use listCanvasTasksNeedingEstimates */
export async function listCanvasDeadlinesWithoutTasks(
  periodStart: string,
  periodEnd: string,
): Promise<
  Array<{
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    external_event_id: string | null;
  }>
> {
  const tasks = await listCanvasTasksNeedingEstimates(periodStart, periodEnd);
  return tasks.map((task) => ({
    id: task.related_event_id ?? task.id,
    title: task.title,
    start_at: task.due_at ?? periodStart,
    end_at: task.due_at ?? periodEnd,
    external_event_id: null,
  }));
}

export async function getTaskByRelatedEventId(
  eventId: string,
): Promise<TaskRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("related_event_id", eventId)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load related task");
  }

  return data;
}

export async function upsertWorkloadSnapshot(
  summary: WorkloadSummary,
  inputHash: string,
): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("workload_snapshots")
    .select("id, input_hash")
    .eq("user_id", user.id)
    .eq("period_type", summary.periodType)
    .eq("period_start", summary.periodStart)
    .eq("period_end", summary.periodEnd)
    .maybeSingle();

  if (existing?.input_hash === inputHash) {
    return;
  }

  const payload = {
    user_id: user.id,
    period_type: summary.periodType,
    period_start: summary.periodStart,
    period_end: summary.periodEnd,
    fixed_minutes: summary.fixedMinutes,
    raw_open_minutes: summary.rawOpenMinutes,
    reserved_buffer_minutes: summary.reservedBufferMinutes,
    available_focus_minutes: summary.availableFocusMinutes,
    required_task_minutes: summary.requiredTaskMinutes,
    allocated_task_minutes: summary.allocatedTaskMinutes,
    unallocated_task_minutes: summary.unallocatedTaskMinutes,
    scheduled_focus_minutes: summary.scheduledFocusMinutes,
    unestimated_task_count: summary.unestimatedTaskCount,
    overdue_task_count: summary.overdueTaskCount,
    capacity_ratio: summary.capacityRatio,
    status: summary.status,
    summary: {
      daySummaries: summary.daySummaries,
      allocation: summary.allocation,
      tentativeEventIds: summary.tentativeEventIds,
      unestimatedTaskIds: summary.unestimatedTaskIds,
      highestPressureDays: summary.highestPressureDays,
      explanation: summary.explanation,
      hasIncompleteData: summary.hasIncompleteData,
      needsAvailabilityConfiguration: summary.needsAvailabilityConfiguration,
    },
    input_hash: inputHash,
    calculated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("workload_snapshots").upsert(payload, {
    onConflict: "user_id,period_type,period_start,period_end",
  });

  if (error) {
    throw new DatabaseError("Failed to save workload snapshot");
  }
}

async function resolvePeriod(
  request: WorkloadPeriodRequest,
): Promise<{
  periodStart: Date;
  periodEnd: Date;
  dayKeys: string[];
  weekStartsOn: 0 | 1;
}> {
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const reference = nowInAppTimezone();

  if (request.startDateKey && request.endDateKey) {
    const dayKeys: string[] = [];
    let current = request.startDateKey;
    while (current <= request.endDateKey) {
      dayKeys.push(current);
      current = addAppDays(current, 1);
      if (dayKeys.length > 60) break;
    }
    return {
      periodStart: toUtcFromAppLocalDate(request.startDateKey),
      periodEnd: toUtcEndOfAppLocalDay(request.endDateKey),
      dayKeys,
      weekStartsOn,
    };
  }

  if (request.periodType === "day") {
    const bounds = getTodayBoundsUtc(reference);
    return {
      periodStart: bounds.start,
      periodEnd: bounds.end,
      dayKeys: [getAppLocalDateKey(reference)],
      weekStartsOn,
    };
  }

  const { start, end } = getWeekBounds(
    reference,
    weekStartsOn,
    request.weekOffset ?? 0,
  );

  return {
    periodStart: start,
    periodEnd: end,
    dayKeys: getWeekDayKeys(start, weekStartsOn),
    weekStartsOn,
  };
}

export async function calculateAndCacheWorkload(
  request: WorkloadPeriodRequest,
): Promise<WorkloadSummary> {
  const period = await resolvePeriod(request);
  const now = new Date();

  const [events, tasks, availabilityRules, preferences] = await Promise.all([
    fetchEventsForWorkload(period.periodStart, period.periodEnd),
    fetchActiveTasks(),
    listAvailabilityRules(),
    getPlanningPreferences(),
  ]);

  const inputs = buildWorkloadInputs({
    events,
    tasks,
    availabilityRules,
    preferences,
    weekStartsOn: period.weekStartsOn,
    now,
    periodType: request.periodType,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    dayKeys: period.dayKeys,
  });

  const summary = calculateWorkload(inputs);
  const inputHash = computeWorkloadInputHash(inputs);

  try {
    await upsertWorkloadSnapshot(summary, inputHash);
  } catch {
    // Snapshot caching is optional; calculation still returns.
  }

  return summary;
}

export const getCachedWorkload = cache(calculateAndCacheWorkload);

export async function getTasksAtRiskIds(): Promise<Set<string>> {
  const summary = await getCachedWorkload({ periodType: "week" });
  return new Set(summary.allocation.tasksAtRisk);
}
