import { TodayView } from "@/components/today/today-view";
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
import { getTodayBoundsUtc } from "@/lib/dates/timezone";
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

export default async function TodayPage() {
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

  const bounds = getTodayBoundsUtc();

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

  return (
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
    />
  );
}
