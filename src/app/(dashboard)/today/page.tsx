import { TodayView } from "@/components/today/today-view";
import { ActiveTimerPanelNotice } from "@/components/timer/active-timer-panel-notice";
import {
  getNextUpcomingEvent,
  listTodayEvents,
} from "@/lib/data/events";
import { getActivePlanningRun } from "@/lib/data/planning";
import { listTodayAndOverdueTasks, listTasks } from "@/lib/data/tasks";
import {
  getCachedWorkload,
  listCanvasTasksNeedingEstimates,
} from "@/lib/data/workload";
import { getActiveBreakForDate } from "@/lib/academic/exception-filter";
import { getActiveTerm } from "@/lib/academic/active-term";
import { listAcademicTerms } from "@/lib/data/academic/terms";
import { listExceptionsForTerm } from "@/lib/data/academic/exceptions";
import { getAppLocalDateKey, getTodayBoundsUtc, nowInAppTimezone } from "@/lib/dates/timezone";
import { getCompletedReviewSession, getDailyPriorities } from "@/lib/data/reviews";
import { countBlocksAwaitingFeedback } from "@/lib/planning/awaiting-feedback";
import {
  countInboxTasks,
  detectDailyPeriod,
} from "@/lib/reviews/loaders";
import type { RelatedCanvasTask } from "@/components/events/event-list";
import type { TaskRow } from "@/types/domain";

function buildRelatedTasksByEventId(tasks: TaskRow[]): Map<string, RelatedCanvasTask> {
  const map = new Map<string, RelatedCanvasTask>();
  for (const task of tasks) {
    if (task.related_event_id) {
      map.set(task.related_event_id, {
        id: task.id,
        missingEstimate:
          task.remaining_minutes == null && task.estimated_minutes == null,
      });
    }
  }
  return map;
}

type TodayPageProps = {
  searchParams: Promise<{ panel?: string; entry?: string }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const params = await searchParams;
  let eventsError: string | null = null;
  let tasksError: string | null = null;
  let workloadError: string | null = null;
  let events: Awaited<ReturnType<typeof listTodayEvents>> = [];
  let nextEvent: Awaited<ReturnType<typeof getNextUpcomingEvent>> = null;
  let dueToday: Awaited<ReturnType<typeof listTodayAndOverdueTasks>>["dueToday"] = [];
  let overdue: Awaited<ReturnType<typeof listTodayAndOverdueTasks>>["overdue"] = [];
  let workload: Awaited<ReturnType<typeof getCachedWorkload>> | null = null;
  let canvasTasksNeedingEstimates: Awaited<
    ReturnType<typeof listCanvasTasksNeedingEstimates>
  > = [];
  let allocatedToday: Awaited<ReturnType<typeof listTasks>> = [];
  let planningRun: Awaited<ReturnType<typeof getActivePlanningRun>> = null;
  let planningError: string | null = null;
  let academicBreakTitle: string | null = null;
  let dailyPriorities: Awaited<ReturnType<typeof getDailyPriorities>> = [];
  let inboxCount = 0;
  let awaitingFeedbackCount = 0;
  let reviewPrompt: {
    period: "morning" | "evening";
    completed: boolean;
  } | null = null;

  const bounds = getTodayBoundsUtc();
  const todayKey = getAppLocalDateKey(nowInAppTimezone());

  try {
    const terms = await listAcademicTerms();
    const active = getActiveTerm(terms);
    if (active) {
      const exceptions = await listExceptionsForTerm(active.id);
      academicBreakTitle = getActiveBreakForDate(todayKey, exceptions)?.title ?? null;
    }
  } catch {
    academicBreakTitle = null;
  }

  try {
    [events, nextEvent] = await Promise.all([
      listTodayEvents(),
      getNextUpcomingEvent(),
    ]);
  } catch (error) {
    eventsError =
      error instanceof Error ? error.message : "Failed to load events";
  }

  try {
    ({ dueToday, overdue } = await listTodayAndOverdueTasks());
  } catch (error) {
    tasksError =
      error instanceof Error ? error.message : "Failed to load tasks";
  }

  try {
    workload = await getCachedWorkload({ periodType: "day" });
    const allocatedIds = new Set(
      workload.allocation.perDayAllocations[0]?.taskEntries.map(
        (entry) => entry.taskId,
      ) ?? [],
    );
    if (allocatedIds.size > 0) {
      const tasks = await listTasks({ status: "active", sort: "due_date" });
      allocatedToday = tasks.filter((task) => allocatedIds.has(task.id));
    }
    canvasTasksNeedingEstimates = await listCanvasTasksNeedingEstimates(
      bounds.start.toISOString(),
      bounds.end.toISOString(),
    );
  } catch (error) {
    workloadError =
      error instanceof Error ? error.message : "Failed to load workload";
  }

  try {
    planningRun = await getActivePlanningRun({ periodType: "day" });
  } catch (error) {
    planningError =
      error instanceof Error ? error.message : "Failed to load planning proposals";
  }

  const allTasks = await listTasks({ status: "active", sort: "due_date" });
  const relatedTasksByEventId = buildRelatedTasksByEventId(allTasks);

  try {
    const period = detectDailyPeriod();
    const reviewType =
      period === "morning" ? "morning_daily" : "evening_daily";
    const [priorities, inbox, feedback, completedReview] = await Promise.all([
      getDailyPriorities(todayKey),
      countInboxTasks(),
      countBlocksAwaitingFeedback(),
      getCompletedReviewSession({ reviewType, reviewDate: todayKey }),
    ]);
    dailyPriorities = priorities;
    inboxCount = inbox;
    awaitingFeedbackCount = feedback;
    reviewPrompt = {
      period,
      completed: completedReview != null,
    };
  } catch {
    reviewPrompt = null;
  }

  return (
    <>
      <ActiveTimerPanelNotice panel={params.panel} />
      <TodayView
        events={events}
        dueToday={dueToday}
        overdue={overdue}
        allocatedToday={allocatedToday}
        nextEvent={nextEvent}
        workload={workload}
        canvasTasksNeedingEstimates={canvasTasksNeedingEstimates}
        relatedTasksByEventId={relatedTasksByEventId}
        planningRun={planningRun}
        eventsError={eventsError}
        tasksError={tasksError}
        workloadError={workloadError}
        planningError={planningError}
        academicBreakTitle={academicBreakTitle}
        reviewPrompt={reviewPrompt}
        dailyPriorities={dailyPriorities}
        inboxCount={inboxCount}
        awaitingFeedbackCount={awaitingFeedbackCount}
      />
    </>
  );
}
