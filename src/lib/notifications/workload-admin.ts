import type { SupabaseClient } from "@supabase/supabase-js";
import { buildWorkloadInputs } from "@/lib/planning/mappers";
import { computeWorkloadInputHash } from "@/lib/planning/input-hash";
import { calculateWorkload } from "@/lib/planning/workload";
import type { WorkloadPeriodType, WorkloadSummary } from "@/lib/planning/types";
import {
  getAppLocalDateKey,
  getTodayBoundsUtc,
  getWeekBounds,
  getWeekDayKeys,
  nowInAppTimezone,
} from "@/lib/dates/timezone";
import type { Database } from "@/types/database.types";
import type {
  AvailabilityRuleRow,
  EventRow,
  PlanningPreferencesRow,
  ProfileRow,
  TaskRow,
} from "@/types/domain";

type DbClient = SupabaseClient<Database>;

async function fetchProfile(
  client: DbClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function fetchPreferences(
  client: DbClient,
  userId: string,
): Promise<PlanningPreferencesRow | null> {
  const { data } = await client
    .from("planning_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

async function fetchEvents(
  client: DbClient,
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<EventRow[]> {
  const { data } = await client
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", periodStart.toISOString())
    .lte("start_at", periodEnd.toISOString());
  return data ?? [];
}

async function fetchActiveTasks(
  client: DbClient,
  userId: string,
): Promise<TaskRow[]> {
  const { data } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["open", "in_progress", "deferred"])
    .order("due_at", { ascending: true });
  return data ?? [];
}

async function fetchAvailability(
  client: DbClient,
  userId: string,
): Promise<AvailabilityRuleRow[]> {
  const { data } = await client
    .from("availability_rules")
    .select("*")
    .eq("user_id", userId);
  return data ?? [];
}

function resolvePeriodForUser(
  profile: ProfileRow,
  periodType: WorkloadPeriodType,
  reference = nowInAppTimezone(),
) {
  const weekStartsOn = profile.week_starts_on as 0 | 1;

  if (periodType === "day") {
    const bounds = getTodayBoundsUtc(reference);
    return {
      periodStart: bounds.start,
      periodEnd: bounds.end,
      dayKeys: [getAppLocalDateKey(reference)],
      weekStartsOn,
    };
  }

  const { start, end } = getWeekBounds(reference, weekStartsOn, 0);
  return {
    periodStart: start,
    periodEnd: end,
    dayKeys: getWeekDayKeys(start, weekStartsOn),
    weekStartsOn,
  };
}

export async function calculateWorkloadForUser(
  client: DbClient,
  userId: string,
  periodType: WorkloadPeriodType,
): Promise<WorkloadSummary | null> {
  const [profile, preferences] = await Promise.all([
    fetchProfile(client, userId),
    fetchPreferences(client, userId),
  ]);

  if (!profile || !preferences) return null;

  const period = resolvePeriodForUser(profile, periodType);
  const now = new Date();

  const [events, tasks, availabilityRules] = await Promise.all([
    fetchEvents(client, userId, period.periodStart, period.periodEnd),
    fetchActiveTasks(client, userId),
    fetchAvailability(client, userId),
  ]);

  const inputs = buildWorkloadInputs({
    events,
    tasks,
    availabilityRules,
    preferences,
    weekStartsOn: period.weekStartsOn,
    now,
    periodType,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    dayKeys: period.dayKeys,
  });

  const summary = calculateWorkload(inputs);
  const inputHash = computeWorkloadInputHash(inputs);

  try {
    await client.from("workload_snapshots").upsert(
      {
        user_id: userId,
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
      },
      { onConflict: "user_id,period_type,period_start,period_end" },
    );
  } catch {
    // Snapshot caching is optional
  }

  return summary;
}

export async function fetchDeadlineTasks(
  client: DbClient,
  userId: string,
  warningHours: number,
): Promise<TaskRow[]> {
  const now = new Date();
  const deadline = new Date(now.getTime() + warningHours * 60 * 60 * 1000);

  const { data } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["open", "in_progress", "deferred"])
    .not("due_at", "is", null)
    .not("estimated_minutes", "is", null)
    .gte("due_at", now.toISOString())
    .lte("due_at", deadline.toISOString());

  return (data ?? []).filter((task) => {
    const remaining = task.remaining_minutes ?? task.estimated_minutes ?? 0;
    return remaining > 0;
  });
}

export function countBlockingEvents(events: EventRow[]): number {
  return events.filter(
    (event) =>
      event.blocks_time &&
      event.status !== "cancelled" &&
      event.status !== "tentative" &&
      event.event_type !== "deadline",
  ).length;
}

export async function calculateWorkloadWithEventCount(
  client: DbClient,
  userId: string,
  periodType: WorkloadPeriodType,
): Promise<{ summary: WorkloadSummary; fixedEventCount: number } | null> {
  const [profile, preferences] = await Promise.all([
    fetchProfile(client, userId),
    fetchPreferences(client, userId),
  ]);

  if (!profile || !preferences) return null;

  const period = resolvePeriodForUser(profile, periodType);
  const now = new Date();

  const [events, tasks, availabilityRules] = await Promise.all([
    fetchEvents(client, userId, period.periodStart, period.periodEnd),
    fetchActiveTasks(client, userId),
    fetchAvailability(client, userId),
  ]);

  const fixedEventCount = countBlockingEvents(events);

  const inputs = buildWorkloadInputs({
    events,
    tasks,
    availabilityRules,
    preferences,
    weekStartsOn: period.weekStartsOn,
    now,
    periodType,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    dayKeys: period.dayKeys,
  });

  const summary = calculateWorkload(inputs);
  const inputHash = computeWorkloadInputHash(inputs);

  try {
    await client.from("workload_snapshots").upsert(
      {
        user_id: userId,
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
      },
      { onConflict: "user_id,period_type,period_start,period_end" },
    );
  } catch {
    // Snapshot caching is optional
  }

  return { summary, fixedEventCount };
}

export async function findAllowedUserId(
  client: DbClient,
  allowedEmail: string,
): Promise<string | null> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", allowedEmail.toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}
