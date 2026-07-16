import { formatMinutes, workloadStatusSentence } from "@/lib/planning/summaries";
import { formatAppDate } from "@/lib/dates/timezone";
import {
  destinationForNotificationType,
  resolveNotificationDestination,
  type NotificationDestination,
} from "@/lib/notifications/destination";
import { sanitizeInternalReturnPath } from "@/lib/notifications/destination";
import type { NotificationPayload } from "@/lib/notifications/schemas";
import type { WorkloadSummary } from "@/lib/planning/types";
import type { NotificationPrivacyMode, NotificationType } from "@/types/domain";

function finalizePayload(
  notificationType: NotificationType,
  fields: {
    title: string;
    body: string;
    tag: string;
  },
  destinationOverrides?: Partial<{
    taskId: string;
    planningBlockId: string;
    timeEntryId: string;
    taskView: "today" | "upcoming" | "overdue" | "waiting";
    localDate: string;
    weekStart: string;
  }>,
  destination?: NotificationDestination,
): NotificationPayload {
  const dest =
    destination ??
    destinationForNotificationType(notificationType, destinationOverrides);
  const url = resolveNotificationDestination(dest);
  return {
    version: 1,
    notificationType,
    destination: dest,
    title: fields.title,
    body: fields.body,
    tag: fields.tag,
    url,
  };
}

export function buildTestPayload(): NotificationPayload {
  return finalizePayload("test", {
    title: "LifeOS test",
    body: "Notifications are working.",
    tag: "lifeos-test",
  });
}

export function buildDailyAgendaPayload(
  summary: WorkloadSummary,
  privacyMode: NotificationPrivacyMode,
  fixedEventCount?: number,
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload("daily_agenda", {
      title: "LifeOS daily plan",
      body: "Your agenda and workload summary are ready.",
      tag: "lifeos-daily",
    });
  }

  const eventCount = fixedEventCount ?? 0;
  const statusText = workloadStatusSentence(summary.status, "Today").toLowerCase();
  const focusText = formatMinutes(summary.availableFocusMinutes);
  const taskText = formatMinutes(summary.allocatedTaskMinutes);
  const body = `${eventCount} event${eventCount === 1 ? "" : "s"}, ${focusText} available focus time, ${taskText} of recommended task work, and ${statusText}.`;

  return finalizePayload("daily_agenda", {
    title: "LifeOS daily plan",
    body,
    tag: "lifeos-daily",
  });
}

export function buildWeeklySummaryPayload(
  summary: WorkloadSummary,
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload("weekly_summary", {
      title: "LifeOS weekly outlook",
      body: "Your upcoming workload summary is ready.",
      tag: "lifeos-weekly",
    });
  }

  const statusText = workloadStatusSentence(summary.status, "This week").toLowerCase();
  const unestimated =
    summary.unestimatedTaskCount > 0
      ? `${summary.unestimatedTaskCount} task${summary.unestimatedTaskCount === 1 ? "" : "s"} need estimates`
      : null;
  const pressureDayKey = summary.highestPressureDays[0];
  const pressureText = pressureDayKey
    ? `${formatAppDate(pressureDayKey, "EEEE")} is the highest-pressure day`
    : null;

  const parts = [statusText, unestimated, pressureText].filter(Boolean);
  const classHint =
    summary.fixedMinutes > 0
      ? `${Math.round(summary.fixedMinutes / 60)}h of scheduled commitments`
      : null;
  const body = `This week is ${summary.status === "heavy" || summary.status === "overloaded" ? "heavy" : "active"}. ${[classHint, ...parts].filter(Boolean).join(". ")}.`;

  return finalizePayload("weekly_summary", {
    title: "LifeOS weekly outlook",
    body: body.trim(),
    tag: "lifeos-weekly",
  });
}

export function buildDeadlineWarningPayload(
  taskCount: number,
  warningHours: number,
  privacyMode: NotificationPrivacyMode,
  options?: { taskId?: string; overdue?: boolean },
): NotificationPayload {
  const taskView = options?.overdue ? "overdue" : "upcoming";
  if (privacyMode === "private") {
    return finalizePayload(
      "deadline_warning",
      {
        title: "LifeOS deadline reminder",
        body: "Deadlines need attention soon.",
        tag: "lifeos-deadline",
      },
      { taskId: options?.taskId, taskView },
    );
  }

  const label =
    taskCount === 1
      ? "One deadline needs attention"
      : `${taskCount} deadlines need attention`;
  const body = `${label} in the next ${warningHours} hours.`;

  return finalizePayload(
    "deadline_warning",
    {
      title: "LifeOS deadline reminder",
      body,
      tag: "lifeos-deadline",
    },
    { taskId: options?.taskId, taskView },
  );
}

export function buildOverloadWarningPayload(
  summary: WorkloadSummary,
  privacyMode: NotificationPrivacyMode,
  _periodType: "day" | "week" = "day",
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload("overload_warning", {
      title: "LifeOS workload warning",
      body: "Your schedule needs attention.",
      tag: "lifeos-overload",
    });
  }

  const periodLabel = _periodType === "week" ? "This week" : "Today";
  const statusText = workloadStatusSentence(summary.status, periodLabel);
  const unallocated =
    summary.unallocatedTaskMinutes > 0
      ? `${formatMinutes(summary.unallocatedTaskMinutes)} of task work remains unallocated`
      : "Required work cannot fit in available time";

  return finalizePayload("overload_warning", {
    title: "LifeOS workload warning",
    body: `${statusText}. ${unallocated}.`,
    tag: "lifeos-overload",
  });
}

export function buildStaleTimerPayload(
  taskTitle: string | null,
  thresholdHours: number,
  privacyMode: NotificationPrivacyMode,
  options?: { timeEntryId?: string },
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload(
      "stale_timer",
      {
        title: "LifeOS timer",
        body: `A task timer has been running for more than ${thresholdHours} hours.`,
        tag: "lifeos-stale-timer",
      },
      { timeEntryId: options?.timeEntryId },
    );
  }

  const title = taskTitle ?? "A task";
  return finalizePayload(
    "stale_timer",
    {
      title: "LifeOS timer",
      body: `Your timer for "${title}" has been running for more than ${thresholdHours} hours.`,
      tag: "lifeos-stale-timer",
    },
    { timeEntryId: options?.timeEntryId },
  );
}

export function buildMorningReviewPayload(
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload("morning_review", {
      title: "LifeOS morning review",
      body: "Your morning review is ready.",
      tag: "lifeos-morning-review",
    });
  }

  return finalizePayload("morning_review", {
    title: "LifeOS morning review",
    body: "Start your morning review to set priorities for today.",
    tag: "lifeos-morning-review",
  });
}

export function buildEveningReviewPayload(
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload("evening_review", {
      title: "LifeOS evening review",
      body: "Your evening review is ready.",
      tag: "lifeos-evening-review",
    });
  }

  return finalizePayload("evening_review", {
    title: "LifeOS evening review",
    body: "Wrap up today and plan unfinished work in your evening review.",
    tag: "lifeos-evening-review",
  });
}

export function buildWeeklyReviewPayload(
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload("weekly_review", {
      title: "LifeOS weekly review",
      body: "Your weekly review is ready.",
      tag: "lifeos-weekly-review",
    });
  }

  return finalizePayload("weekly_review", {
    title: "LifeOS weekly review",
    body: "Take a few minutes to review last week and set priorities for the week ahead.",
    tag: "lifeos-weekly-review",
  });
}

export function buildWaitingFollowupPayload(
  taskCount: number,
  privacyMode: NotificationPrivacyMode,
  options?: { taskId?: string },
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload(
      "waiting_followup",
      {
        title: "LifeOS waiting follow-up",
        body: "Tasks you are waiting on need a follow-up.",
        tag: "lifeos-waiting-followup",
      },
      { taskId: options?.taskId },
    );
  }

  const label =
    taskCount === 1
      ? "One waiting task needs follow-up"
      : `${taskCount} waiting tasks need follow-up`;

  return finalizePayload(
    "waiting_followup",
    {
      title: "LifeOS waiting follow-up",
      body: `${label}.`,
      tag: "lifeos-waiting-followup",
    },
    { taskId: options?.taskId },
  );
}

export function buildOverdueDecisionPayload(
  taskCount: number,
  privacyMode: NotificationPrivacyMode,
  options?: { taskId?: string },
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload(
      "overdue_decision",
      {
        title: "LifeOS overdue tasks",
        body: "Overdue tasks need a decision.",
        tag: "lifeos-overdue-decision",
      },
      { taskId: options?.taskId },
    );
  }

  const label =
    taskCount === 1
      ? "One overdue task needs a decision"
      : `${taskCount} overdue tasks need decisions`;

  return finalizePayload(
    "overdue_decision",
    {
      title: "LifeOS overdue tasks",
      body: `${label}.`,
      tag: "lifeos-overdue-decision",
    },
    { taskId: options?.taskId },
  );
}

export function buildPlanningFeedbackPayload(
  blockCount: number,
  privacyMode: NotificationPrivacyMode,
  options?: { planningBlockId?: string },
): NotificationPayload {
  if (privacyMode === "private") {
    return finalizePayload(
      "planning_feedback",
      {
        title: "LifeOS planning feedback",
        body: "Past focus blocks need your feedback.",
        tag: "lifeos-planning-feedback",
      },
      { planningBlockId: options?.planningBlockId },
    );
  }

  const label =
    blockCount === 1
      ? "One focus block needs feedback"
      : `${blockCount} focus blocks need feedback`;

  return finalizePayload(
    "planning_feedback",
    {
      title: "LifeOS planning feedback",
      body: `${label}.`,
      tag: "lifeos-planning-feedback",
    },
    { planningBlockId: options?.planningBlockId },
  );
}

export function buildFallbackPayload(): NotificationPayload {
  return finalizePayload("daily_agenda", {
    title: "LifeOS",
    body: "You have a new notification.",
    tag: "lifeos-fallback",
  });
}

export function serializePayload(payload: NotificationPayload): string {
  const destination = payload.destination;
  const url = sanitizeInternalReturnPath(
    payload.url ||
      (destination
        ? resolveNotificationDestination(destination)
        : "/today"),
  );
  return JSON.stringify({
    version: payload.version ?? 1,
    notificationType: payload.notificationType,
    destination,
    deliveryId: payload.deliveryId,
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url,
    badgeCount: payload.badgeCount,
  });
}
