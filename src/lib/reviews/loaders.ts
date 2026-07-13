import { addDays, format } from "date-fns";
import { listTodayEvents, listEventsInRange } from "@/lib/data/events";
import { getActivePlanningRun } from "@/lib/data/planning";
import { listTodayAndOverdueTasks, listTasks } from "@/lib/data/tasks";
import { getCachedWorkload } from "@/lib/data/workload";
import { getActiveTimer } from "@/lib/data/time-entries";
import { getProfile } from "@/lib/data/bootstrap";
import { listBlocksAwaitingFeedback } from "@/lib/planning/awaiting-feedback";
import {
  getCompletedReviewSession,
  getDailyPriorities,
  getInProgressReviewSession,
  getWeeklyPriorities,
  listReviewDecisionsForSession,
} from "@/lib/data/reviews";
import {
  getAppLocalDateKey,
  getTodayBoundsUtc,
  getWeekBounds,
  nowInAppTimezone,
  toUtcEndOfAppLocalDay,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import { isStaleTimer } from "@/lib/time/stale-timer";
import { getPlanningPreferences } from "@/lib/data/preferences";
import type {
  EveningReviewContext,
  MorningReviewContext,
  WeeklyReviewContext,
} from "@/lib/reviews/types";
import type { TaskRow } from "@/types/domain";

async function listInboxTasks(): Promise<TaskRow[]> {
  const tasks = await listTasks({ status: "active", sort: "due_date" });
  return tasks.filter(
    (task) =>
      (task as TaskRow & { inbox_at?: string | null }).inbox_at != null,
  );
}

export async function countInboxTasks(): Promise<number> {
  const inbox = await listInboxTasks();
  return inbox.length;
}

function reviewTypeForPeriod(period: "morning" | "evening") {
  return period === "morning" ? "morning_daily" : "evening_daily";
}

export async function loadMorningContext(
  dateKey?: string,
): Promise<MorningReviewContext> {
  const today = nowInAppTimezone();
  const key = dateKey ?? getAppLocalDateKey(today);
  const reviewType = reviewTypeForPeriod("morning");

  const [
    events,
    { dueToday, overdue },
    workload,
    planningRun,
    inboxTasks,
    activeTimer,
    dailyPriorities,
    session,
    completedSession,
    preferences,
  ] = await Promise.all([
    listTodayEvents(),
    listTodayAndOverdueTasks(),
    getCachedWorkload({ periodType: "day" }).catch(() => null),
    getActivePlanningRun({ periodType: "day" }).catch(() => null),
    listInboxTasks(),
    getActiveTimer().catch(() => null),
    getDailyPriorities(key),
    getInProgressReviewSession({ reviewType, reviewDate: key }),
    getCompletedReviewSession({ reviewType, reviewDate: key }),
    getPlanningPreferences().catch(() => null),
  ]);

  const threshold = preferences?.stale_timer_threshold_hours ?? 4;
  const staleTimer =
    activeTimer != null &&
    isStaleTimer(activeTimer, threshold, new Date());

  return {
    period: "morning",
    dateKey: key,
    events,
    dueToday,
    overdue,
    workload,
    planningRun,
    inboxCount: inboxTasks.length,
    inboxTasks,
    activeTimer,
    staleTimer,
    dailyPriorities,
    session,
    completedSession,
  };
}

export async function loadEveningContext(
  dateKey?: string,
): Promise<EveningReviewContext> {
  const today = nowInAppTimezone();
  const key = dateKey ?? getAppLocalDateKey(today);
  const reviewType = reviewTypeForPeriod("evening");
  const bounds = getTodayBoundsUtc(today);
  const tomorrowKey = format(addDays(toUtcFromAppLocalDate(key), 1), "yyyy-MM-dd");
  const tomorrowStart = toUtcFromAppLocalDate(tomorrowKey).toISOString();
  const tomorrowEnd = toUtcEndOfAppLocalDay(tomorrowKey).toISOString();

  const [
    activeTasks,
    completedTasks,
    awaitingFeedback,
    activeTimer,
    inboxTasks,
    tomorrowEvents,
    session,
    completedSession,
  ] = await Promise.all([
    listTasks({ status: "active", sort: "due_date" }),
    listTasks({ status: "completed", sort: "due_date" }),
    listBlocksAwaitingFeedback({
      since: bounds.start.toISOString(),
      until: bounds.end.toISOString(),
    }),
    getActiveTimer().catch(() => null),
    listInboxTasks(),
    listEventsInRange(tomorrowStart, tomorrowEnd),
    getInProgressReviewSession({ reviewType, reviewDate: key }),
    getCompletedReviewSession({ reviewType, reviewDate: key }),
  ]);

  const completedToday = completedTasks.filter((task) => {
    if (!task.completed_at) return false;
    return getAppLocalDateKey(task.completed_at) === key;
  });

  const unfinished = activeTasks.filter((task) => {
    if (task.due_at && getAppLocalDateKey(task.due_at) === key) return true;
    return task.status === "in_progress";
  });

  const sortedTomorrow = [...tomorrowEvents].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  const tomorrowFirstCommitment =
    sortedTomorrow.find((event) => !event.all_day) ?? sortedTomorrow[0] ?? null;

  const priorDecisions = session
    ? await listReviewDecisionsForSession(session.id)
    : completedSession
      ? await listReviewDecisionsForSession(completedSession.id)
      : [];

  return {
    period: "evening",
    dateKey: key,
    completedToday,
    unfinished,
    awaitingFeedback,
    activeTimer,
    inboxCount: inboxTasks.length,
    tomorrowEvents,
    tomorrowFirstCommitment,
    session,
    completedSession,
    priorDecisions,
  };
}

export async function loadWeeklyContext(
  weekOffset = 0,
): Promise<WeeklyReviewContext> {
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const reference = nowInAppTimezone();
  const { start: weekStart } = getWeekBounds(
    reference,
    weekStartsOn,
    weekOffset,
  );
  const weekStartDate = getAppLocalDateKey(weekStart);

  const previousWeekStartDate = format(
    addDays(weekStart, -7),
    "yyyy-MM-dd",
  );
  const { start: prevStart, end: prevEnd } = getWeekBounds(
    addDays(weekStart, -7),
    weekStartsOn,
    0,
  );

  const nextWeekStartDate = format(addDays(weekStart, 7), "yyyy-MM-dd");
  const { start: nextStart, end: nextEnd } = getWeekBounds(
    addDays(weekStart, 7),
    weekStartsOn,
    0,
  );

  const [
    previousWorkload,
    nextWorkload,
    previousPlanningRun,
    nextPlanningRun,
    activeTasks,
    completedTasks,
    inboxTasks,
    nextWeekEvents,
    weeklyPriorities,
    session,
    completedSession,
  ] = await Promise.all([
    getCachedWorkload({ periodType: "week", weekOffset: weekOffset - 1 }).catch(
      () => null,
    ),
    getCachedWorkload({ periodType: "week", weekOffset: weekOffset + 1 }).catch(
      () => null,
    ),
    getActivePlanningRun({
      periodType: "week",
      weekOffset: weekOffset - 1,
    }).catch(() => null),
    getActivePlanningRun({
      periodType: "week",
      weekOffset: weekOffset + 1,
    }).catch(() => null),
    listTasks({ status: "active", sort: "due_date" }),
    listTasks({ status: "completed", sort: "due_date" }),
    listInboxTasks(),
    listEventsInRange(
      nextStart.toISOString(),
      nextEnd.toISOString(),
    ),
    getWeeklyPriorities(weekStartDate),
    getInProgressReviewSession({
      reviewType: "weekly",
      reviewWeekStart: weekStartDate,
    }),
    getCompletedReviewSession({
      reviewType: "weekly",
      reviewWeekStart: weekStartDate,
    }),
  ]);

  const prevStartKey = getAppLocalDateKey(prevStart);
  const prevEndKey = getAppLocalDateKey(prevEnd);

  const completedLastWeek = completedTasks.filter((task) => {
    if (!task.completed_at) return false;
    const completedKey = getAppLocalDateKey(task.completed_at);
    return completedKey >= prevStartKey && completedKey <= prevEndKey;
  });

  const carriedForward = activeTasks.filter((task) => {
    if (!task.due_at) return false;
    const dueKey = getAppLocalDateKey(task.due_at);
    return dueKey < weekStartDate;
  });

  const waitingTasks = activeTasks.filter(
    (task) =>
      (task as TaskRow & { workflow_state?: string }).workflow_state ===
      "waiting",
  );

  const nextWeekStartKey = getAppLocalDateKey(nextStart);
  const nextWeekEndKey = getAppLocalDateKey(nextEnd);
  const nextWeekDeadlines = activeTasks.filter((task) => {
    if (!task.due_at) return false;
    const dueKey = getAppLocalDateKey(task.due_at);
    return dueKey >= nextWeekStartKey && dueKey <= nextWeekEndKey;
  });

  return {
    weekStartDate,
    previousWeekStart: previousWeekStartDate,
    previousWeekEnd: getAppLocalDateKey(prevEnd),
    nextWeekStart: nextWeekStartDate,
    nextWeekEnd: getAppLocalDateKey(nextEnd),
    previousWorkload,
    nextWorkload,
    previousPlanningRun,
    nextPlanningRun,
    completedLastWeek,
    carriedForward,
    inboxTasks,
    waitingTasks,
    nextWeekEvents,
    nextWeekDeadlines,
    weeklyPriorities,
    session,
    completedSession,
  };
}

export function detectDailyPeriod(
  hour = nowInAppTimezone().getHours(),
): "morning" | "evening" {
  return hour < 14 ? "morning" : "evening";
}
