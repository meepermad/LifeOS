import Link from "next/link";
import {
  formatAppDate,
  formatAppTimeRange,
  getAppLocalDateKey,
  nowInAppTimezone,
} from "@/lib/dates/timezone";
import type { EventWithCalendar } from "@/lib/data/events";
import type { TaskRow } from "@/types/domain";
import type { RelatedCanvasTask } from "@/components/events/event-list";
import type { WorkloadSummary } from "@/lib/planning/types";
import type { PlanningRunWithProposals } from "@/lib/data/planning";
import { EventListItem } from "@/components/events/event-list";
import { PlanningControls } from "@/components/planning/planning-controls";
import { WorkloadSummaryCard } from "@/components/workload/workload-summary-card";
import { EmptyState, SectionCard } from "@/components/forms/ui";
import { QuickAddMenu } from "@/components/quick-add/quick-add-menu";

export function TodayView({
  events,
  dueToday,
  overdue,
  allocatedToday,
  nextEvent,
  workload,
  canvasTasksNeedingEstimates,
  relatedTasksByEventId,
  planningRun,
  eventsError,
  tasksError,
  workloadError,
  planningError,
  academicBreakTitle,
}: {
  events: EventWithCalendar[];
  dueToday: TaskRow[];
  overdue: TaskRow[];
  allocatedToday: TaskRow[];
  nextEvent: EventWithCalendar | null;
  workload: WorkloadSummary | null;
  canvasTasksNeedingEstimates: Array<{ id: string; title: string; due_at: string | null }>;
  relatedTasksByEventId: Map<string, RelatedCanvasTask>;
  planningRun: PlanningRunWithProposals | null;
  eventsError?: string | null;
  tasksError?: string | null;
  workloadError?: string | null;
  planningError?: string | null;
  academicBreakTitle?: string | null;
}) {
  const today = nowInAppTimezone();
  const todayKey = getAppLocalDateKey(today);
  const allDay = events.filter((event) => event.all_day);
  const timed = events.filter((event) => !event.all_day);
  const isEmpty =
    events.length === 0 &&
    dueToday.length === 0 &&
    overdue.length === 0 &&
    allocatedToday.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-muted">
            {formatAppDate(today, "EEEE, MMMM d")}
            {academicBreakTitle ? ` · ${academicBreakTitle}` : ""}
          </p>
          <Link href="/calendar" className="mt-1 inline-block text-xs text-accent">
            Open calendar
          </Link>
          <Link href="/school" className="mt-1 ml-3 inline-block text-xs text-accent">
            School & semester setup
          </Link>
        </div>
        <QuickAddMenu />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {workloadError ? (
            <SectionCard title="Workload">
              <p className="text-sm text-danger">{workloadError}</p>
            </SectionCard>
          ) : workload ? (
            <WorkloadSummaryCard workload={workload} />
          ) : null}

          {canvasTasksNeedingEstimates.length > 0 && (
            <SectionCard title="Canvas tasks needing estimates">
              <ul className="space-y-2">
                {canvasTasksNeedingEstimates.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/tasks/${task.id}/edit`}
                      className="text-sm text-foreground hover:text-accent"
                    >
                      {task.title}
                    </Link>
                    <span className="ml-2 text-xs text-warning">Estimate needed</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          {nextEvent && !eventsError && (
            <SectionCard title="Next event">
              <p className="font-medium text-foreground">{nextEvent.title}</p>
              <p className="mt-1 text-sm text-muted">
                {nextEvent.all_day
                  ? "All day"
                  : formatAppTimeRange(nextEvent.start_at, nextEvent.end_at)}
                {" · "}
                {nextEvent.calendar_name}
              </p>
            </SectionCard>
          )}

          <SectionCard title="Today's events">
            {eventsError ? (
              <p className="text-sm text-danger">{eventsError}</p>
            ) : events.length === 0 ? (
              <EmptyState message="No events scheduled for today." />
            ) : (
              <div className="space-y-2">
                {allDay.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted">All day</p>
                    {allDay.map((event) => (
                      <EventListItem
                        key={event.id}
                        event={event}
                        relatedTask={relatedTasksByEventId.get(event.id)}
                      />
                    ))}
                  </div>
                )}
                {timed.map((event) => (
                  <EventListItem
                    key={event.id}
                    event={event}
                    relatedTask={relatedTasksByEventId.get(event.id)}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {planningError ? (
        <SectionCard title="Planning proposals">
          <p className="text-sm text-danger">{planningError}</p>
        </SectionCard>
      ) : (
        <PlanningControls periodType="day" planningRun={planningRun} />
      )}

      <SectionCard title="Tasks due today">        {tasksError ? (
          <p className="text-sm text-danger">{tasksError}</p>
        ) : dueToday.length === 0 ? (
          <EmptyState message="No open tasks due today." />
        ) : (
          <ul className="space-y-2">
            {dueToday.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}/edit`}
                  className="text-sm text-foreground hover:text-accent"
                >
                  {task.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Recommended for today">
        {tasksError ? (
          <p className="text-sm text-danger">{tasksError}</p>
        ) : allocatedToday.length === 0 ? (
          <EmptyState message="No analytically allocated task work for today." />
        ) : (
          <ul className="space-y-2">
            {allocatedToday.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}/edit`}
                  className="text-sm text-foreground hover:text-accent"
                >
                  {task.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Overdue tasks">
        {tasksError ? (
          <p className="text-sm text-danger">{tasksError}</p>
        ) : overdue.length === 0 ? (
          <EmptyState message="No overdue tasks." />
        ) : (
          <ul className="space-y-2">
            {overdue.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}/edit`}
                  className="text-sm text-danger hover:underline"
                >
                  {task.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {isEmpty && !eventsError && !tasksError && !workload && (
        <EmptyState message="Your day is clear. Add an event or task to get started." />
      )}

      {workload?.daySummaries.find((day) => day.dateKey === todayKey) && (
        <p className="text-xs text-muted">
          Workload recommendations are analytical. Use Plan today above to propose
          focus blocks you can accept into LifeOS Planning.
        </p>
      )}    </div>
  );
}
