import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { parse } from "date-fns";
import { APP_TIMEZONE } from "@/lib/constants";
import {
  findDeliveryByKey,
  isDeliveryComplete,
  markDeliverySkipped,
} from "@/lib/notifications/delivery";
import {
  buildDailyAgendaPayload,
  buildDeadlineWarningPayload,
  buildOverloadWarningPayload,
  buildWeeklySummaryPayload,
} from "@/lib/notifications/payloads";
import { sendNotificationToUser } from "@/lib/notifications/sender";
import {
  calculateWorkloadWithEventCount,
  fetchDeadlineTasks,
} from "@/lib/notifications/workload-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { PlanningPreferencesRow } from "@/types/domain";
import { getAppLocalDateKey } from "@/lib/dates/timezone";

type DbClient = SupabaseClient<Database>;

const WINDOW_MINUTES = 15;
const OVERLOAD_COOLDOWN_HOURS = 12;

export function buildDailyDedupKey(userId: string, dateKey: string): string {
  return `daily_agenda:${userId}:${dateKey}`;
}

export function buildWeeklyDedupKey(userId: string, weekStartKey: string): string {
  return `weekly_summary:${userId}:${weekStartKey}`;
}

export function buildDeadlineDedupKey(
  userId: string,
  dateKey: string,
  warningHours: number,
): string {
  return `deadline_warning:${userId}:${dateKey}:${warningHours}`;
}

export function buildOverloadDedupKey(
  userId: string,
  periodType: "day" | "week",
  dateKey: string,
): string {
  return `overload_warning:${userId}:${periodType}:${dateKey}`;
}

export function buildTestDedupKey(userId: string, minuteBucket: string): string {
  return `test:${userId}:${minuteBucket}`;
}

function normalizeTime(time: string | null): string | null {
  if (!time) return null;
  return time.length === 5 ? `${time}:00` : time;
}

function timeToMinutes(time: string): number {
  const normalized = normalizeTime(time) ?? "00:00:00";
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function getLocalNowParts(now: Date) {
  const dateKey = getAppLocalDateKey(now);
  const timeStr = formatInTimeZone(now, APP_TIMEZONE, "HH:mm:ss");
  const dayOfWeek = toZonedTime(now, APP_TIMEZONE).getDay();
  const minutes = timeToMinutes(timeStr);
  const windowStart = Math.floor(minutes / WINDOW_MINUTES) * WINDOW_MINUTES;
  const windowEnd = windowStart + WINDOW_MINUTES;
  return { dateKey, timeStr, dayOfWeek, minutes, windowStart, windowEnd };
}

export function isScheduledTimeInWindow(
  scheduledTime: string | null,
  windowStart: number,
  windowEnd: number,
): boolean {
  const normalized = normalizeTime(scheduledTime);
  if (!normalized) return false;
  const scheduledMinutes = timeToMinutes(normalized);
  return scheduledMinutes >= windowStart && scheduledMinutes < windowEnd;
}

export function isScheduledTimeStale(
  scheduledTime: string | null,
  windowStart: number,
): boolean {
  const normalized = normalizeTime(scheduledTime);
  if (!normalized) return true;
  const scheduledMinutes = timeToMinutes(normalized);
  return scheduledMinutes < windowStart;
}

export function isInQuietHours(
  nowMinutes: number,
  quietStart: string | null,
  quietEnd: string | null,
): boolean {
  if (!quietStart || !quietEnd) return false;
  const start = timeToMinutes(quietStart);
  const end = timeToMinutes(quietEnd);
  if (start === end) return false;
  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  return nowMinutes >= start || nowMinutes < end;
}

function getWeekStartKey(
  dateKey: string,
  weekStartsOn: 0 | 1,
): string {
  const date = parse(dateKey, "yyyy-MM-dd", new Date());
  const day = date.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - diff);
  return formatInTimeZone(weekStart, APP_TIMEZONE, "yyyy-MM-dd");
}

export type ProcessResult = {
  daily: number;
  weekly: number;
  deadline: number;
  overload: number;
  skipped: number;
  errors: number;
};

export async function processScheduledNotifications(
  client: DbClient,
  userId: string,
  preferences: PlanningPreferencesRow,
  weekStartsOn: 0 | 1,
  now = new Date(),
): Promise<ProcessResult> {
  const result: ProcessResult = {
    daily: 0,
    weekly: 0,
    deadline: 0,
    overload: 0,
    skipped: 0,
    errors: 0,
  };

  if (!preferences.notifications_enabled) {
    return result;
  }

  const { dateKey, dayOfWeek, minutes, windowStart, windowEnd } =
    getLocalNowParts(now);

  if (
    isInQuietHours(
      minutes,
      preferences.quiet_hours_start,
      preferences.quiet_hours_end,
    )
  ) {
    return result;
  }

  const privacyMode =
    preferences.notification_privacy_mode === "detailed"
      ? "detailed"
      : "private";
  const scheduledFor = now.toISOString();

  if (preferences.daily_notifications_enabled) {
    const dedupKey = buildDailyDedupKey(userId, dateKey);
    const existing = await findDeliveryByKey(client, dedupKey);

    if (existing && isDeliveryComplete(existing.status)) {
      result.skipped += 1;
    } else if (isScheduledTimeStale(preferences.daily_notification_time, windowStart)) {
      await markDeliverySkipped(client, {
        userId,
        notificationType: "daily_agenda",
        scheduledFor,
        deduplicationKey: dedupKey,
        reason: "Stale delivery window",
      });
      result.skipped += 1;
    } else if (
      isScheduledTimeInWindow(
        preferences.daily_notification_time,
        windowStart,
        windowEnd,
      )
    ) {
      const result2 = await calculateWorkloadWithEventCount(client, userId, "day");
      if (result2) {
        const { summary, fixedEventCount } = result2;
        const payload = buildDailyAgendaPayload(summary, privacyMode, fixedEventCount);
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "daily_agenda",
          payload,
          deduplicationKey: dedupKey,
          scheduledFor,
          periodStart: summary.periodStart,
          periodEnd: summary.periodEnd,
          payloadSummary: { status: summary.status },
        });
        if (sendResult.successCount > 0) result.daily += 1;
        else if (sendResult.subscriptionCount === 0) result.skipped += 1;
        else result.errors += 1;
      }
    }
  }

  if (preferences.weekly_notifications_enabled) {
    const weekStartKey = getWeekStartKey(dateKey, weekStartsOn);
    const dedupKey = buildWeeklyDedupKey(userId, weekStartKey);
    const existing = await findDeliveryByKey(client, dedupKey);
    const isWeeklyDay = dayOfWeek === preferences.weekly_notification_day;

    if (existing && isDeliveryComplete(existing.status)) {
      result.skipped += 1;
    } else if (!isWeeklyDay) {
      // not due today
    } else if (
      isScheduledTimeStale(preferences.weekly_notification_time, windowStart)
    ) {
      await markDeliverySkipped(client, {
        userId,
        notificationType: "weekly_summary",
        scheduledFor,
        deduplicationKey: dedupKey,
        reason: "Stale delivery window",
      });
      result.skipped += 1;
    } else if (
      isScheduledTimeInWindow(
        preferences.weekly_notification_time,
        windowStart,
        windowEnd,
      )
    ) {
      const result2 = await calculateWorkloadWithEventCount(client, userId, "week");
      if (result2) {
        const { summary } = result2;
        const payload = buildWeeklySummaryPayload(summary, privacyMode);
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "weekly_summary",
          payload,
          deduplicationKey: dedupKey,
          scheduledFor,
          periodStart: summary.periodStart,
          periodEnd: summary.periodEnd,
          payloadSummary: { status: summary.status },
        });
        if (sendResult.successCount > 0) result.weekly += 1;
        else if (sendResult.subscriptionCount === 0) result.skipped += 1;
        else result.errors += 1;
      }
    }
  }

  if (preferences.deadline_notifications_enabled) {
    const warningHours = preferences.deadline_warning_hours;
    const dedupKey = buildDeadlineDedupKey(userId, dateKey, warningHours);
    const existing = await findDeliveryByKey(client, dedupKey);

    if (!existing || !isDeliveryComplete(existing.status)) {
      const tasks = await fetchDeadlineTasks(client, userId, warningHours);
      if (tasks.length > 0) {
        const payload = buildDeadlineWarningPayload(
          tasks.length,
          warningHours,
          privacyMode,
        );
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "deadline_warning",
          payload,
          deduplicationKey: dedupKey,
          scheduledFor,
          payloadSummary: { taskCount: tasks.length },
        });
        if (sendResult.successCount > 0) result.deadline += 1;
        else if (sendResult.subscriptionCount === 0) result.skipped += 1;
        else result.errors += 1;
      }
    }
  }

  if (preferences.overload_notifications_enabled) {
    const dedupKey = buildOverloadDedupKey(userId, "day", dateKey);
    const existing = await findDeliveryByKey(client, dedupKey);

    const cooldownSince = new Date(
      now.getTime() - OVERLOAD_COOLDOWN_HOURS * 60 * 60 * 1000,
    ).toISOString();

    let recentlySent = false;
    if (existing && isDeliveryComplete(existing.status)) {
      const { data } = await client
        .from("notification_deliveries")
        .select("sent_at")
        .eq("deduplication_key", dedupKey)
        .maybeSingle();
      if (data?.sent_at && data.sent_at >= cooldownSince) {
        recentlySent = true;
      }
    }

    if (!recentlySent) {
      const result2 = await calculateWorkloadWithEventCount(client, userId, "day");
      const summary = result2?.summary;
      const isOverloaded =
        summary &&
        (summary.status === "overloaded" || summary.status === "no_capacity") &&
        (summary.unallocatedTaskMinutes > 0 ||
          summary.requiredTaskMinutes > summary.availableFocusMinutes);

      if (isOverloaded && summary) {
        const payload = buildOverloadWarningPayload(
          summary,
          privacyMode,
          "day",
        );
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "overload_warning",
          payload,
          deduplicationKey: dedupKey,
          scheduledFor,
          payloadSummary: { status: summary.status },
        });
        if (sendResult.successCount > 0) result.overload += 1;
        else if (sendResult.subscriptionCount === 0) result.skipped += 1;
        else result.errors += 1;
      }
    }
  }

  return result;
}
