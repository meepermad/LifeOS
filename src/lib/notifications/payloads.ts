import { formatMinutes, workloadStatusSentence } from "@/lib/planning/summaries";
import { formatAppDate } from "@/lib/dates/timezone";
import { sanitizeNotificationUrl } from "@/lib/notifications/privacy";
import type { NotificationPayload } from "@/lib/notifications/schemas";
import type { WorkloadSummary } from "@/lib/planning/types";
import type { NotificationPrivacyMode } from "@/types/domain";

export function buildTestPayload(): NotificationPayload {
  return {
    title: "LifeOS test",
    body: "Notifications are working.",
    tag: "lifeos-test",
    url: "/settings",
  };
}

export function buildDailyAgendaPayload(
  summary: WorkloadSummary,
  privacyMode: NotificationPrivacyMode,
  fixedEventCount?: number,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS daily plan",
      body: "Your agenda and workload summary are ready.",
      tag: "lifeos-daily",
      url: "/today",
    };
  }

  const eventCount = fixedEventCount ?? 0;
  const statusText = workloadStatusSentence(summary.status, "Today").toLowerCase();
  const focusText = formatMinutes(summary.availableFocusMinutes);
  const taskText = formatMinutes(summary.allocatedTaskMinutes);
  const body = `${eventCount} event${eventCount === 1 ? "" : "s"}, ${focusText} available focus time, ${taskText} of recommended task work, and ${statusText}.`;

  return {
    title: "LifeOS daily plan",
    body,
    tag: "lifeos-daily",
    url: "/today",
  };
}

export function buildWeeklySummaryPayload(
  summary: WorkloadSummary,
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS weekly outlook",
      body: "Your upcoming workload summary is ready.",
      tag: "lifeos-weekly",
      url: "/week",
    };
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

  return {
    title: "LifeOS weekly outlook",
    body: body.trim(),
    tag: "lifeos-weekly",
    url: "/week",
  };
}

export function buildDeadlineWarningPayload(
  taskCount: number,
  warningHours: number,
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS deadline reminder",
      body: "Deadlines need attention soon.",
      tag: "lifeos-deadline",
      url: "/tasks",
    };
  }

  const label =
    taskCount === 1
      ? "One deadline needs attention"
      : `${taskCount} deadlines need attention`;
  const body = `${label} in the next ${warningHours} hours.`;

  return {
    title: "LifeOS deadline reminder",
    body,
    tag: "lifeos-deadline",
    url: "/tasks",
  };
}

export function buildOverloadWarningPayload(
  summary: WorkloadSummary,
  privacyMode: NotificationPrivacyMode,
  periodType: "day" | "week" = "day",
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS workload warning",
      body: "Your schedule needs attention.",
      tag: "lifeos-overload",
      url: periodType === "week" ? "/week" : "/today",
    };
  }

  const periodLabel = periodType === "week" ? "This week" : "Today";
  const statusText = workloadStatusSentence(summary.status, periodLabel);
  const unallocated =
    summary.unallocatedTaskMinutes > 0
      ? `${formatMinutes(summary.unallocatedTaskMinutes)} of task work remains unallocated`
      : "Required work cannot fit in available time";

  return {
    title: "LifeOS workload warning",
    body: `${statusText}. ${unallocated}.`,
    tag: "lifeos-overload",
    url: periodType === "week" ? "/week" : "/today",
  };
}

export function buildStaleTimerPayload(
  taskTitle: string | null,
  thresholdHours: number,
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS timer",
      body: `A task timer has been running for more than ${thresholdHours} hours.`,
      tag: "lifeos-stale-timer",
      url: "/today?timer=stale",
    };
  }

  const title = taskTitle ?? "A task";
  return {
    title: "LifeOS timer",
    body: `Your timer for "${title}" has been running for more than ${thresholdHours} hours.`,
    tag: "lifeos-stale-timer",
    url: "/today?timer=stale",
  };
}

export function buildMorningReviewPayload(
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS morning review",
      body: "Your morning review is ready.",
      tag: "lifeos-morning-review",
      url: "/review/daily",
    };
  }

  return {
    title: "LifeOS morning review",
    body: "Start your morning review to set priorities for today.",
    tag: "lifeos-morning-review",
    url: "/review/daily",
  };
}

export function buildEveningReviewPayload(
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS evening review",
      body: "Your evening review is ready.",
      tag: "lifeos-evening-review",
      url: "/review/daily?mode=evening",
    };
  }

  return {
    title: "LifeOS evening review",
    body: "Wrap up today and plan unfinished work in your evening review.",
    tag: "lifeos-evening-review",
    url: "/review/daily?mode=evening",
  };
}

export function buildWeeklyReviewPayload(
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS weekly review",
      body: "Your weekly review is ready.",
      tag: "lifeos-weekly-review",
      url: "/review/weekly",
    };
  }

  return {
    title: "LifeOS weekly review",
    body: "Take a few minutes to review last week and set priorities for the week ahead.",
    tag: "lifeos-weekly-review",
    url: "/review/weekly",
  };
}

export function buildWaitingFollowupPayload(
  taskCount: number,
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS waiting follow-up",
      body: "Tasks you are waiting on need a follow-up.",
      tag: "lifeos-waiting-followup",
      url: "/tasks",
    };
  }

  const label =
    taskCount === 1
      ? "One waiting task needs follow-up"
      : `${taskCount} waiting tasks need follow-up`;

  return {
    title: "LifeOS waiting follow-up",
    body: `${label}.`,
    tag: "lifeos-waiting-followup",
    url: "/tasks",
  };
}

export function buildOverdueDecisionPayload(
  taskCount: number,
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS overdue tasks",
      body: "Overdue tasks need a decision.",
      tag: "lifeos-overdue-decision",
      url: "/today",
    };
  }

  const label =
    taskCount === 1
      ? "One overdue task needs a decision"
      : `${taskCount} overdue tasks need decisions`;

  return {
    title: "LifeOS overdue tasks",
    body: `${label}.`,
    tag: "lifeos-overdue-decision",
    url: "/today",
  };
}

export function buildPlanningFeedbackPayload(
  blockCount: number,
  privacyMode: NotificationPrivacyMode,
): NotificationPayload {
  if (privacyMode === "private") {
    return {
      title: "LifeOS planning feedback",
      body: "Past focus blocks need your feedback.",
      tag: "lifeos-planning-feedback",
      url: "/today",
    };
  }

  const label =
    blockCount === 1
      ? "One focus block needs feedback"
      : `${blockCount} focus blocks need feedback`;

  return {
    title: "LifeOS planning feedback",
    body: `${label}.`,
    tag: "lifeos-planning-feedback",
    url: "/today",
  };
}

export function buildFallbackPayload(): NotificationPayload {
  return {
    title: "LifeOS",
    body: "You have a new notification.",
    tag: "lifeos-fallback",
    url: "/today",
  };
}

export function serializePayload(payload: NotificationPayload): string {
  const safeUrl = sanitizeNotificationUrl(payload.url);
  return JSON.stringify({ ...payload, url: safeUrl });
}
