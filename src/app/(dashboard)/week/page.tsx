import Link from "next/link";
import {
  groupEventsByAppDay,
  WeekAgenda,
} from "@/components/events/event-list";
import { WeekWorkloadSummary } from "@/components/workload/week-workload-summary";
import { PlanningControls } from "@/components/planning/planning-controls";
import { getProfile } from "@/lib/data/bootstrap";
import { listEventsInRange } from "@/lib/data/events";
import { getActivePlanningRun } from "@/lib/data/planning";
import { listTasks } from "@/lib/data/tasks";
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
import { getCachedWorkload } from "@/lib/data/workload";
import {
  formatAppDate,
  getWeekBounds,
  getWeekDayKeys,
  nowInAppTimezone,
} from "@/lib/dates/timezone";

type WeekPageProps = {
  searchParams: Promise<{ offset?: string }>;
};

export default async function WeekPage({ searchParams }: WeekPageProps) {
  const params = await searchParams;
  const weekOffset = Number(params.offset ?? 0) || 0;
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const reference = nowInAppTimezone();
  const { start, end } = getWeekBounds(reference, weekStartsOn, weekOffset);
  const [events, workload, planningRun] = await Promise.all([
    listEventsInRange(start.toISOString(), end.toISOString()),
    getCachedWorkload({ periodType: "week", weekOffset }),
    getActivePlanningRun({ periodType: "week", weekOffset }),
  ]);
  const dayKeys = getWeekDayKeys(start, weekStartsOn);
  const eventsByDay = groupEventsByAppDay(events);
  const daySummaries = new Map(
    workload.daySummaries.map((day) => [day.dateKey, day]),
  );

  const tasks = await listTasks({ status: "active", sort: "due_date" });
  const relatedTasksByEventId = buildRelatedTasksByEventId(tasks);

  const prevOffset = weekOffset - 1;
  const nextOffset = weekOffset + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Week</h1>
          <p className="mt-1 text-sm text-muted">
            {formatAppDate(start, "MMM d")} – {formatAppDate(end, "MMM d, yyyy")}
          </p>
        </div>
        <Link
          href="/events/new"
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover"
        >
          + Event
        </Link>
      </div>

      <nav className="grid grid-cols-3 gap-2" aria-label="Week navigation">
        <Link
          href={`/week?offset=${prevOffset}`}
          className="rounded-lg border border-border px-3 py-2 text-center text-sm text-muted hover:border-accent hover:text-foreground"
        >
          Previous
        </Link>
        <Link
          href="/week"
          className="rounded-lg border border-border px-3 py-2 text-center text-sm text-foreground hover:border-accent"
        >
          Current
        </Link>
        <Link
          href={`/week?offset=${nextOffset}`}
          className="rounded-lg border border-border px-3 py-2 text-center text-sm text-muted hover:border-accent hover:text-foreground"
        >
          Next
        </Link>
      </nav>

      <WeekWorkloadSummary workload={workload} />

      <PlanningControls
        periodType="week"
        weekOffset={weekOffset}
        planningRun={planningRun}
      />

      <WeekAgenda        dayKeys={dayKeys}
        eventsByDay={eventsByDay}
        daySummaries={daySummaries}
        relatedTasksByEventId={relatedTasksByEventId}
      />
    </div>
  );
}
