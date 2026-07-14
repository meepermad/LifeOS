import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";
import {
  getLocalDateKeyInTimezone,
  getLocalWeekdayInTimezone,
  getWeekStartKeyInTimezone,
  isValidIanaTimeZone,
  resolveLocalNotificationInstant,
} from "@/lib/dates/timezone";
import {
  findDeliveryByKey,
  suppressesDuplicateDelivery,
} from "@/lib/notifications/delivery";
import {
  evaluateTimedEligibility,
  logNotificationEligibility,
  scheduledVersusProcessingOffsetMinutes,
  type NotificationEligibilityStage,
} from "@/lib/notifications/eligibility";
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
import type { SendResult } from "@/lib/notifications/schemas";
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
import type { NotificationType, PlanningPreferencesRow } from "@/types/domain";

type DbClient = SupabaseClient<Database>;

const OVERLOAD_COOLDOWN_HOURS = 12;

/** @deprecated Prefer evaluateTimedEligibility with resolved UTC instants. */
export const WINDOW_MINUTES = 15;

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

/**
 * @deprecated Window helpers retained for legacy unit coverage.
 * Prefer evaluateTimedEligibility + resolveLocalNotificationInstant.
 */
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

/**
 * @deprecated Prefer evaluateTimedEligibility with a resolved scheduled instant.
 */
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
  usersProcessed: number;
  disabled: number;
  notDue: number;
  stale: number;
  deduplicated: number;
  noContent: number;
  noSubscription: number;
  attempted: number;
  sent: number;
  failed: number;
  /** Aggregate non-sent outcomes kept for backward-compatible cron consumers. */
  skipped: number;
  errors: number;
};

function emptyResult(overrides: Partial<ProcessResult> = {}): ProcessResult {
  return {
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
    usersProcessed: 0,
    disabled: 0,
    notDue: 0,
    stale: 0,
    deduplicated: 0,
    noContent: 0,
    noSubscription: 0,
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    ...overrides,
  };
}

function resolveTimezone(timezone: string | null | undefined): string {
  if (timezone && isValidIanaTimeZone(timezone)) return timezone;
  return APP_TIMEZONE;
}

function recordSendOutcome(
  result: ProcessResult,
  sendResult: SendResult,
  successKey?: keyof ProcessResult,
): void {
  result.attempted += 1;

  if (sendResult.deduplicated) {
    result.deduplicated += 1;
    result.skipped += 1;
    return;
  }

  if (sendResult.subscriptionCount === 0) {
    result.noSubscription += 1;
    result.skipped += 1;
    return;
  }

  if (sendResult.successCount > 0) {
    result.sent += 1;
    if (successKey) {
      result[successKey] = (result[successKey] as number) + 1;
    }
    return;
  }

  result.failed += 1;
  result.errors += 1;
}

function logStage(
  notificationType: NotificationType | string,
  stage: NotificationEligibilityStage,
  timezone: string,
  options?: {
    safeSkipReason?: string | null;
    scheduledInstant?: Date;
    now?: Date;
  },
): void {
  logNotificationEligibility({
    notificationType,
    eligibilityStage: stage,
    safeSkipReason: options?.safeSkipReason ?? null,
    resolvedTimezone: timezone,
    scheduledVersusProcessingOffsetMinutes:
      options?.scheduledInstant && options.now
        ? scheduledVersusProcessingOffsetMinutes(
            options.scheduledInstant,
            options.now,
          )
        : undefined,
  });
}

type BuiltNotification = {
  payload: ReturnType<typeof buildMorningReviewPayload>;
  periodStart?: string | null;
  periodEnd?: string | null;
  payloadSummary?: Record<string, unknown>;
};

async function processTimedWallClock(input: {
  client: DbClient;
  userId: string;
  result: ProcessResult;
  timezone: string;
  now: Date;
  nowMinutes: number;
  quietStart: string | null;
  quietEnd: string | null;
  enabled: boolean;
  notificationType: NotificationType;
  localDate: string;
  localTime: string | null | undefined;
  dedupKey: string;
  dayEligible?: boolean;
  successKey: keyof ProcessResult;
  loadAndBuild: () => Promise<BuiltNotification | null>;
}): Promise<void> {
  const { result, notificationType, timezone, now, dedupKey, client, userId } =
    input;

  if (!input.enabled) {
    result.disabled += 1;
    logStage(notificationType, "disabled", timezone);
    return;
  }

  if (input.dayEligible === false) {
    result.notDue += 1;
    logStage(notificationType, "not_due_yet", timezone, {
      safeSkipReason: "Wrong local weekday",
    });
    return;
  }

  if (!input.localTime) {
    result.disabled += 1;
    logStage(notificationType, "disabled", timezone, {
      safeSkipReason: "Missing configured time",
    });
    return;
  }

  let scheduledInstant: Date;
  try {
    scheduledInstant = resolveLocalNotificationInstant({
      localDate: input.localDate,
      localTime: input.localTime,
      timezone,
    });
  } catch {
    result.errors += 1;
    logStage(notificationType, "failed", timezone, {
      safeSkipReason: "Invalid local time or timezone",
    });
    return;
  }

  const timedStage = evaluateTimedEligibility(scheduledInstant, now);

  if (timedStage === "not_due_yet") {
    // Must not create or claim a delivery row for not-due evaluations.
    result.notDue += 1;
    logStage(notificationType, "not_due_yet", timezone, {
      scheduledInstant,
      now,
    });
    return;
  }

  if (timedStage === "stale") {
    // Stale relative to the correctly resolved instant; do not claim the key.
    // Premature skips from older builds remain retryable via claim reclaim.
    result.stale += 1;
    result.skipped += 1;
    logStage(notificationType, "stale", timezone, {
      safeSkipReason: "Outside grace window",
      scheduledInstant,
      now,
    });
    return;
  }

  if (isInQuietHours(input.nowMinutes, input.quietStart, input.quietEnd)) {
    result.skipped += 1;
    logStage(notificationType, "quiet_hours", timezone, {
      safeSkipReason: "Quiet hours",
      scheduledInstant,
      now,
    });
    return;
  }

  const existing = await findDeliveryByKey(client, dedupKey);
  if (existing && suppressesDuplicateDelivery(existing.status)) {
    result.deduplicated += 1;
    result.skipped += 1;
    logStage(notificationType, "already_sent", timezone, {
      safeSkipReason: `Existing status ${existing.status}`,
      scheduledInstant,
      now,
    });
    return;
  }

  const built = await input.loadAndBuild();
  if (!built) {
    result.noContent += 1;
    result.skipped += 1;
    logStage(notificationType, "no_eligible_content", timezone, {
      safeSkipReason: "No eligible content",
      scheduledInstant,
      now,
    });
    return;
  }

  // Store the resolved scheduled instant — not the processing clock time.
  const scheduledFor = scheduledInstant.toISOString();
  const sendResult = await sendNotificationToUser(client, {
    userId,
    notificationType,
    payload: built.payload,
    deduplicationKey: dedupKey,
    scheduledFor,
    periodStart: built.periodStart,
    periodEnd: built.periodEnd,
    payloadSummary: built.payloadSummary,
  });

  if (sendResult.subscriptionCount === 0 && !sendResult.deduplicated) {
    logStage(notificationType, "no_subscription", timezone, {
      safeSkipReason: "No active push subscription",
      scheduledInstant,
      now,
    });
  } else if (sendResult.successCount > 0) {
    logStage(notificationType, "sent", timezone, {
      scheduledInstant,
      now,
    });
  } else if (sendResult.deduplicated) {
    logStage(notificationType, "already_sent", timezone, {
      safeSkipReason: "Concurrent claim",
      scheduledInstant,
      now,
    });
  } else {
    logStage(notificationType, "failed", timezone, {
      safeSkipReason: "Push delivery failed",
      scheduledInstant,
      now,
    });
  }

  recordSendOutcome(result, sendResult, input.successKey);
}

export async function processScheduledNotifications(
  client: DbClient,
  userId: string,
  preferences: PlanningPreferencesRow,
  weekStartsOn: 0 | 1,
  now = new Date(),
  timezoneInput: string = APP_TIMEZONE,
): Promise<ProcessResult> {
  const timezone = resolveTimezone(timezoneInput);
  const result = emptyResult({ usersProcessed: 1 });

  if (!preferences.notifications_enabled) {
    result.disabled += 1;
    logStage("daily_agenda", "disabled", timezone, {
      safeSkipReason: "Notifications disabled",
    });
    return result;
  }

  const dateKey = getLocalDateKeyInTimezone(now, timezone);
  const dayOfWeek = getLocalWeekdayInTimezone(now, timezone);
  const minutes = timeToMinutes(formatInTimeZone(now, timezone, "HH:mm:ss"));
  const weekStartKey = getWeekStartKeyInTimezone(
    dateKey,
    weekStartsOn,
    timezone,
  );
  const privacyMode =
    preferences.notification_privacy_mode === "detailed"
      ? "detailed"
      : "private";

  await processTimedWallClock({
    client,
    userId,
    result,
    timezone,
    now,
    nowMinutes: minutes,
    quietStart: preferences.quiet_hours_start,
    quietEnd: preferences.quiet_hours_end,
    enabled: preferences.daily_notifications_enabled,
    notificationType: "daily_agenda",
    localDate: dateKey,
    localTime: preferences.daily_notification_time,
    dedupKey: buildDailyDedupKey(userId, dateKey),
    successKey: "daily",
    loadAndBuild: async () => {
      const workload = await calculateWorkloadWithEventCount(
        client,
        userId,
        "day",
      );
      if (!workload) return null;
      const { summary, fixedEventCount } = workload;
      return {
        payload: buildDailyAgendaPayload(summary, privacyMode, fixedEventCount),
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        payloadSummary: { status: summary.status },
      };
    },
  });

  await processTimedWallClock({
    client,
    userId,
    result,
    timezone,
    now,
    nowMinutes: minutes,
    quietStart: preferences.quiet_hours_start,
    quietEnd: preferences.quiet_hours_end,
    enabled: preferences.weekly_notifications_enabled,
    notificationType: "weekly_summary",
    localDate: dateKey,
    localTime: preferences.weekly_notification_time,
    dedupKey: buildWeeklyDedupKey(userId, weekStartKey),
    dayEligible: dayOfWeek === preferences.weekly_notification_day,
    successKey: "weekly",
    loadAndBuild: async () => {
      const workload = await calculateWorkloadWithEventCount(
        client,
        userId,
        "week",
      );
      if (!workload) return null;
      const { summary } = workload;
      return {
        payload: buildWeeklySummaryPayload(summary, privacyMode),
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        payloadSummary: { status: summary.status },
      };
    },
  });

  await processTimedWallClock({
    client,
    userId,
    result,
    timezone,
    now,
    nowMinutes: minutes,
    quietStart: preferences.quiet_hours_start,
    quietEnd: preferences.quiet_hours_end,
    enabled: preferences.morning_review_enabled === true,
    notificationType: "morning_review",
    localDate: dateKey,
    localTime: preferences.morning_review_time ?? "07:00",
    dedupKey: buildMorningReviewDedupKey(userId, dateKey),
    successKey: "morningReview",
    loadAndBuild: async () => {
      const completed = await hasCompletedReviewSession(
        client,
        userId,
        "morning_daily",
        { dateKey },
      );
      if (completed) return null;
      return { payload: buildMorningReviewPayload(privacyMode) };
    },
  });

  await processTimedWallClock({
    client,
    userId,
    result,
    timezone,
    now,
    nowMinutes: minutes,
    quietStart: preferences.quiet_hours_start,
    quietEnd: preferences.quiet_hours_end,
    enabled: preferences.evening_review_enabled === true,
    notificationType: "evening_review",
    localDate: dateKey,
    localTime: preferences.evening_review_time ?? "20:00",
    dedupKey: buildEveningReviewDedupKey(userId, dateKey),
    successKey: "eveningReview",
    loadAndBuild: async () => {
      const completed = await hasCompletedReviewSession(
        client,
        userId,
        "evening_daily",
        { dateKey },
      );
      if (completed) return null;
      return { payload: buildEveningReviewPayload(privacyMode) };
    },
  });

  await processTimedWallClock({
    client,
    userId,
    result,
    timezone,
    now,
    nowMinutes: minutes,
    quietStart: preferences.quiet_hours_start,
    quietEnd: preferences.quiet_hours_end,
    enabled: preferences.weekly_review_reminder_enabled === true,
    notificationType: "weekly_review",
    localDate: dateKey,
    localTime: preferences.weekly_notification_time,
    dedupKey: buildWeeklyReviewDedupKey(userId, weekStartKey),
    dayEligible: dayOfWeek === preferences.weekly_notification_day,
    successKey: "weeklyReview",
    loadAndBuild: async () => {
      const completed = await hasCompletedReviewSession(client, userId, "weekly", {
        weekStartKey,
      });
      if (completed) return null;
      return { payload: buildWeeklyReviewPayload(privacyMode) };
    },
  });

  // Absolute-timestamp notifications: do not combine local date + preference time.
  const inQuietHours = isInQuietHours(
    minutes,
    preferences.quiet_hours_start,
    preferences.quiet_hours_end,
  );

  if (inQuietHours) {
    logStage("deadline_warning", "quiet_hours", timezone, {
      safeSkipReason: "Quiet hours",
    });
    return result;
  }

  const processingInstant = now.toISOString();

  if (preferences.deadline_notifications_enabled) {
    const warningHours = preferences.deadline_warning_hours;
    const dedupKey = buildDeadlineDedupKey(userId, dateKey, warningHours);
    const existing = await findDeliveryByKey(client, dedupKey);

    if (existing && suppressesDuplicateDelivery(existing.status)) {
      result.deduplicated += 1;
      result.skipped += 1;
    } else {
      const tasks = await fetchDeadlineTasks(client, userId, warningHours);
      if (tasks.length === 0) {
        result.noContent += 1;
      } else {
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "deadline_warning",
          payload: buildDeadlineWarningPayload(
            tasks.length,
            warningHours,
            privacyMode,
          ),
          deduplicationKey: dedupKey,
          scheduledFor: processingInstant,
          payloadSummary: { taskCount: tasks.length },
        });
        recordSendOutcome(result, sendResult, "deadline");
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
    if (existing && suppressesDuplicateDelivery(existing.status)) {
      const { data } = await client
        .from("notification_deliveries")
        .select("sent_at")
        .eq("deduplication_key", dedupKey)
        .maybeSingle();
      if (data?.sent_at && data.sent_at >= cooldownSince) {
        recentlySent = true;
      }
    }

    if (recentlySent) {
      result.deduplicated += 1;
      result.skipped += 1;
    } else {
      const workload = await calculateWorkloadWithEventCount(
        client,
        userId,
        "day",
      );
      const summary = workload?.summary;
      const isOverloaded =
        summary &&
        (summary.status === "overloaded" || summary.status === "no_capacity") &&
        (summary.unallocatedTaskMinutes > 0 ||
          summary.requiredTaskMinutes > summary.availableFocusMinutes);

      if (!isOverloaded || !summary) {
        result.noContent += 1;
      } else {
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "overload_warning",
          payload: buildOverloadWarningPayload(summary, privacyMode, "day"),
          deduplicationKey: dedupKey,
          scheduledFor: processingInstant,
          payloadSummary: { status: summary.status },
        });
        recordSendOutcome(result, sendResult, "overload");
      }
    }
  }

  if (preferences.waiting_followup_enabled) {
    const dueTasks = await listWaitingFollowupsDue(client, userId, now);
    if (dueTasks.length === 0) {
      result.noContent += 1;
    }
    for (const task of dueTasks) {
      if (!task.waiting_follow_up_at) continue;
      const followUpDateKey = getLocalDateKeyInTimezone(
        task.waiting_follow_up_at,
        timezone,
      );
      const dedupKey = buildWaitingFollowupDedupKey(
        userId,
        task.id,
        followUpDateKey,
      );
      const existing = await findDeliveryByKey(client, dedupKey);
      if (existing && suppressesDuplicateDelivery(existing.status)) {
        result.deduplicated += 1;
        result.skipped += 1;
        continue;
      }

      const sendResult = await sendNotificationToUser(client, {
        userId,
        notificationType: "waiting_followup",
        payload: buildWaitingFollowupPayload(1, privacyMode),
        deduplicationKey: dedupKey,
        scheduledFor: task.waiting_follow_up_at,
        payloadSummary: { taskCount: 1 },
      });
      recordSendOutcome(result, sendResult, "waitingFollowup");
    }
  }

  if (preferences.overdue_decision_reminder_enabled) {
    const dedupKey = buildOverdueDecisionDedupKey(userId, dateKey);
    const existing = await findDeliveryByKey(client, dedupKey);
    if (existing && suppressesDuplicateDelivery(existing.status)) {
      result.deduplicated += 1;
      result.skipped += 1;
    } else {
      const taskCount = await countOverdueNeedingDecision(client, userId, now);
      if (taskCount === 0) {
        result.noContent += 1;
      } else {
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "overdue_decision",
          payload: buildOverdueDecisionPayload(taskCount, privacyMode),
          deduplicationKey: dedupKey,
          scheduledFor: processingInstant,
          payloadSummary: { taskCount },
        });
        recordSendOutcome(result, sendResult, "overdueDecision");
      }
    }
  }

  if (preferences.planning_feedback_reminder_enabled) {
    const dedupKey = buildPlanningFeedbackDedupKey(userId, dateKey);
    const existing = await findDeliveryByKey(client, dedupKey);
    if (existing && suppressesDuplicateDelivery(existing.status)) {
      result.deduplicated += 1;
      result.skipped += 1;
    } else {
      const blockCount = await countAwaitingPlanningFeedback(
        client,
        userId,
        now,
      );
      if (blockCount === 0) {
        result.noContent += 1;
      } else {
        const sendResult = await sendNotificationToUser(client, {
          userId,
          notificationType: "planning_feedback",
          payload: buildPlanningFeedbackPayload(blockCount, privacyMode),
          deduplicationKey: dedupKey,
          scheduledFor: processingInstant,
          payloadSummary: { blockCount },
        });
        recordSendOutcome(result, sendResult, "planningFeedback");
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
    if (existing && suppressesDuplicateDelivery(existing.status)) {
      result.deduplicated += 1;
      result.skipped += 1;
    } else {
      const sendResult = await sendNotificationToUser(client, {
        userId,
        notificationType: "stale_timer",
        payload: buildStaleTimerPayload(
          activeTimer.task_title_snapshot,
          thresholdHours,
          privacyMode,
        ),
        deduplicationKey: dedupKey,
        scheduledFor: activeTimer.started_at,
        payloadSummary: { thresholdHours },
      });
      if (sendResult.successCount > 0) {
        await client
          .from("planning_preferences")
          .update({ stale_timer_notified_at: now.toISOString() })
          .eq("user_id", userId);
      }
      recordSendOutcome(result, sendResult, "staleTimer");
    }
  }

  return result;
}
