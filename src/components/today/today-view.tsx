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
import type { DailyPriorityWithTask } from "@/lib/reviews/types";
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
  reviewPrompt,
  dailyPriorities,
  inboxCount,
  awaitingFeedbackCount,
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
  reviewPrompt?: {
    period: "morning" | "evening";
    completed: boolean;
  } | null;
  dailyPriorities?: DailyPriorityWithTask[];
  inboxCount?: number;
  awaitingFeedbackCount?: number;
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

      {(reviewPrompt && !reviewPrompt.completed) ||
      (dailyPriorities && dailyPriorities.length > 0) ||
      overdue.length > 0 ||
      (inboxCount ?? 0) > 0 ||
      (awaitingFeedbackCount ?? 0) > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {reviewPrompt && !reviewPrompt.completed && (
            <Link
              href={`/review/daily?period=${reviewPrompt.period}`}
              className="rounded-xl border border-accent/40 bg-accent/10 p-4 transition-colors hover:border-accent"
            >
              <p className="text-sm font-medium text-accent">
                {reviewPrompt.period === "morning"
                  ? "Morning review"
                  : "Evening review"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Guided review ready when you are.
              </p>
            </Link>
          )}

          {dailyPriorities && dailyPriorities.length > 0 && (
            <SectionCard title="Daily priorities">
              <ul className="space-y-2">
                {dailyPriorities.map((priority) => (
                  <li key={priority.id}>
                    <Link
                      href={`/tasks/${priority.task_id}/edit`}
                      className="text-sm text-foreground hover:text-accent"
                    >
                      {priority.task.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {overdue.length > 0 && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <p className="text-sm font-medium text-danger">
                {overdue.length} overdue{" "}
                {overdue.length === 1 ? "task" : "tasks"}
              </p>
              <Link
                href="/review/daily?period=morning"
                className="mt-1 inline-block text-xs text-accent"
              >
                Review in morning review
              </Link>
            </div>
          )}

          {(inboxCount ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">
                {inboxCount} inbox{" "}
                {inboxCount === 1 ? "item" : "items"}
              </p>
            </div>
          )}

          {(awaitingFeedbackCount ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">
                {awaitingFeedbackCount} planning{" "}
                {awaitingFeedbackCount === 1 ? "block" : "blocks"} need
                feedback
              </p>
              <Link
                href="/review/daily?period=evening"
                className="mt-1 inline-block text-xs text-accent"
              >
                Review in evening review
              </Link>
            </div>
          )}
        </div>
      ) : null}

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
