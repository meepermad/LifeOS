import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";
import {
  getAppLocalDateKey,
  getWeekBounds,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import {
  findDeliveryByKey,
  isDeliveryComplete,
  markDeliverySkipped,
} from "@/lib/notifications/delivery";
import {
  buildDailyAgendaPayload,
  buildDeadlineWarningPayload,
  buildEveningReviewPayload,
  buildMorningReviewPayload,
  buildOverloadWarningPayload,
  buildOverdueDecisionPayload,
  buildPlanningFeedbackPayload,
  buildStaleTimerPayload,
  buildWaitingFollowupPayload,
  buildWeeklyReviewPayload,
  buildWeeklySummaryPayload,
} from "@/lib/notifications/payloads";
import { sendNotificationToUser } from "@/lib/notifications/sender";
import {
  calculateWorkloadWithEventCount,
  fetchDeadlineTasks,
} from "@/lib/notifications/workload-admin";
import {
  countAwaitingPlanningFeedback,
  countOverdueNeedingDecision,
  listWaitingFollowupsDue,
  hasCompletedReviewSession,
} from "@/lib/notifications/workflow-queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { PlanningPreferencesRow } from "@/types/domain";

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

export function buildStaleTimerDedupKey(
  userId: string,
  entryId: string,
): string {
  return `stale_timer:${userId}:${entryId}`;
}

export function buildTestDedupKey(userId: string, minuteBucket: string): string {
  return `test:${userId}:${minuteBucket}`;
}

export function buildMorningReviewDedupKey(
  userId: string,
  dateKey: string,
): string {
  return `morning_review:${userId}:${dateKey}`;
}

export function buildEveningReviewDedupKey(
  userId: string,
  dateKey: string,
): string {
  return `evening_review:${userId}:${dateKey}`;
}

export function buildWeeklyReviewDedupKey(
  userId: string,
  weekStartKey: string,
): string {
  return `weekly_review:${userId}:${weekStartKey}`;
}

export function buildWaitingFollowupDedupKey(
  userId: string,
  taskId: string,
  followUpDateKey: string,
): string {
  return `waiting_followup:${userId}:${taskId}:${followUpDateKey}`;
}

export function buildOverdueDecisionDedupKey(
  userId: string,
  dateKey: string,
): string {
  return `overdue_decision:${userId}:${dateKey}`;
}

export function buildPlanningFeedbackDedupKey(
  userId: string,
  dateKey: string,
): string {
  return `planning_feedback:${userId}:${dateKey}`;
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
  const dayStart = toUtcFromAppLocalDate(dateKey);
  const { start } = getWeekBounds(dayStart, weekStartsOn, 0);
  return getAppLocalDateKey(start);
}

export type ProcessResult = {
  daily: number;
  weekly: number;
  deadline: number;
  overload: number;
  staleTimer: number;
  morningReview: number;
  eveningReview: number;
  weeklyReview: number;
  waitingFollowup: number;
  overdueDecision: number;
  planningFeedback: number;
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
    staleTimer: 0,
    morningReview: 0,
    eveningReview: 0,
    weeklyReview: 0,
    waitingFollowup: 0,
    overdueDecision: 0,
    planningFeedback: 0,
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

  const weekStartKey = getWeekStartKey(dateKey, weekStartsOn);

  async function sendTimedReviewReminder(input: {
    enabled: boolean;
    scheduledTime: string | null | undefined;
    dedupKey: string;
    notificationType:
      | "morning_review"
      | "evening_review"
      | "weekly_review";
    buildPayload: () => ReturnType<typeof buildMorningReviewPayload>;
    resultKey: "morningReview" | "eveningReview" | "weeklyReview";
    shouldSend: () => Promise<boolean>;
    extraDayCheck?: boolean;
  }): Promise<void> {
    if (!input.enabled) return;

    if (input.extraDayCheck === false) return;

    const existing = await findDeliveryByKey(client, input.dedupKey);
    if (existing && isDeliveryComplete(existing.status)) {
      result.skipped += 1;
      return;
    }

    if (isScheduledTimeStale(input.scheduledTime ?? null, windowStart)) {
      await markDeliverySkipped(client, {
        userId,
        notificationType: input.notificationType,
        scheduledFor,
        deduplicationKey: input.dedupKey,
        reason: "Stale delivery window",
      });
      result.skipped += 1;
      return;
    }

    if (
      !isScheduledTimeInWindow(
        input.scheduledTime ?? null,
        windowStart,
        windowEnd,
      )
    ) {
      return;
    }

    if (!(await input.shouldSend())) {
      return;
    }

    const payload = input.buildPayload();
    const sendResult = await sendNotificationToUser(client, {
      userId,
      notificationType: input.notificationType,
      payload,
      deduplicationKey: input.dedupKey,
      scheduledFor,
    });

    if (sendResult.successCount > 0) {
      result[input.resultKey] += 1;
    } else if (sendResult.subscriptionCount === 0) {
      result.skipped += 1;
    } else {
      result.errors += 1;
    }
  }

  await sendTimedReviewReminder({
    enabled: preferences.morning_review_enabled === true,
    scheduledTime: preferences.morning_review_time ?? "07:00",
    dedupKey: buildMorningReviewDedupKey(userId, dateKey),
    notificationType: "morning_review",
    buildPayload: () => buildMorningReviewPayload(privacyMode),
    resultKey: "morningReview",
    shouldSend: () =>
      hasCompletedReviewSession(client, userId, "morning_daily", {
        dateKey,
      }).then((completed) => !completed),
  });

  await sendTimedReviewReminder({
    enabled: preferences.evening_review_enabled === true,
    scheduledTime: preferences.evening_review_time ?? "20:00",
    dedupKey: buildEveningReviewDedupKey(userId, dateKey),
    notificationType: "evening_review",
    buildPayload: () => buildEveningReviewPayload(privacyMode),
    resultKey: "eveningReview",
    shouldSend: () =>
      hasCompletedReviewSession(client, userId, "evening_daily", {
        dateKey,
      }).then((completed) => !completed),
  });

  await sendTimedReviewReminder({
    enabled: preferences.weekly_review_reminder_enabled === true,
    scheduledTime: preferences.weekly_notification_time,
    dedupKey: buildWeeklyReviewDedupKey(userId, weekStartKey),
    notificationType: "weekly_review",
    buildPayload: () => buildWeeklyReviewPayload(privacyMode),
    resultKey: "weeklyReview",
    extraDayCheck: dayOfWeek === preferences.weekly_notification_day,
    shouldSend: () =>
      hasCompletedReviewSession(client, userId, "weekly", {
        weekStartKey,
      }).then((completed) => !completed),
  });

  if (preferences.waiting_followup_enabled) {
    const dueTasks = await listWaitingFollowupsDue(client, userId, now);
    for (const task of dueTasks) {
      if (!task.waiting_follow_up_at) continue;
      const followUpDateKey = getAppLocalDateKey(task.waiting_follow_up_at);
      const dedupKey = buildWaitingFollowupDedupKey(
        userId,
        task.id,
        followUpDateKey,
      );
      const existing = await findDeliveryByKey(client, dedupKey);

      if (existing && isDeliveryComplete(existing.status)) {
        continue;
      }

      const payload = buildWaitingFollowupPayload(1, privacyMode);
      const sendResult = await sendNotificationToUser(client, {
        userId,
        notificationType: "waiting_followup",
        payload,
        deduplicationKey: dedupKey,
        scheduledFor,
        payloadSummary: { taskCount: 1 },
      });
      if (sendResult.successCount > 0) result.waitingFollowup += 1;
      else if (sendResult.subscriptionCount === 0) result.skipped += 1;
      else result.errors += 1;
    }
  }

  if (preferences.overdue_decision_reminder_enabled) {
    const dedupKey = buildOverdueDecisionDedupKey(userId, dateKey);
    const existing = await findDeliveryByKey(client, dedupKey);

    if (!existing || !isDeliveryComplete(existing.status)) {
      const taskCount = await countOverdueNeedingDecision(client, userId, now);
      if (taskCount > 0) {
        const payload = buildOverdueDecisionPayload(taskCount, privacyMode);
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "overdue_decision",
          payload,
          deduplicationKey: dedupKey,
          scheduledFor,
          payloadSummary: { taskCount },
        });
        if (sendResult.successCount > 0) result.overdueDecision += 1;
        else if (sendResult.subscriptionCount === 0) result.skipped += 1;
        else result.errors += 1;
      }
    }
  }

  if (preferences.planning_feedback_reminder_enabled) {
    const dedupKey = buildPlanningFeedbackDedupKey(userId, dateKey);
    const existing = await findDeliveryByKey(client, dedupKey);

    if (!existing || !isDeliveryComplete(existing.status)) {
      const blockCount = await countAwaitingPlanningFeedback(client, userId, now);
      if (blockCount > 0) {
        const payload = buildPlanningFeedbackPayload(blockCount, privacyMode);
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "planning_feedback",
          payload,
          deduplicationKey: dedupKey,
          scheduledFor,
          payloadSummary: { blockCount },
        });
        if (sendResult.successCount > 0) result.planningFeedback += 1;
        else if (sendResult.subscriptionCount === 0) result.skipped += 1;
        else result.errors += 1;
      }
    }
  }

  const thresholdHours = preferences.stale_timer_threshold_hours ?? 4;
  const { data: activeTimer } = await client
    .from("task_time_entries")
    .select("id, started_at, task_title_snapshot")
    .eq("user_id", userId)
    .is("ended_at", null)
    .eq("entry_source", "timer")
    .maybeSingle();

  if (
    activeTimer &&
    !preferences.stale_timer_notified_at &&
    (now.getTime() - new Date(activeTimer.started_at).getTime()) /
      (1000 * 60 * 60) >=
      thresholdHours
  ) {
    const dedupKey = buildStaleTimerDedupKey(userId, activeTimer.id);
    const existing = await findDeliveryByKey(client, dedupKey);

    if (!existing || !isDeliveryComplete(existing.status)) {
      const payload = buildStaleTimerPayload(
        activeTimer.task_title_snapshot,
        thresholdHours,
        privacyMode,
      );
      const sendResult = await sendNotificationToUser(client, {
        userId,
        notificationType: "stale_timer",
        payload,
        deduplicationKey: dedupKey,
        scheduledFor,
        payloadSummary: { thresholdHours },
      });

      if (sendResult.successCount > 0) {
        result.staleTimer += 1;
        await client
          .from("planning_preferences")
          .update({ stale_timer_notified_at: now.toISOString() })
          .eq("user_id", userId);
      } else if (sendResult.subscriptionCount === 0) {
        result.skipped += 1;
      } else {
        result.errors += 1;
      }
    }
  }

  return result;
}
