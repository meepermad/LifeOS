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
import type { ActiveTimerState } from "@/lib/data/time-entries";
import { EventListItem } from "@/components/events/event-list";
import { PlanningControls } from "@/components/planning/planning-controls";
import { WorkloadSummaryCard } from "@/components/workload/workload-summary-card";
import { EmptyState, SectionCard } from "@/components/forms/ui";
import { QuickAddMenu } from "@/components/quick-add/quick-add-menu";
import { InlineRecoverableError } from "@/components/ui/inline-recoverable-error";

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function TodayView({
  events,
  workShifts = [],
  dueToday,
  overdue,
  allocatedToday,
  upcomingDeadlines = [],
  nextEvent,
  workload,
  canvasTasksNeedingEstimates,
  relatedTasksByEventId,
  planningRun,
  activeTimer = null,
  recentActivity = [],
  upcomingReminders = [],
  pendingReviews = 0,
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
  workShifts?: EventWithCalendar[];
  dueToday: TaskRow[];
  overdue: TaskRow[];
  allocatedToday: TaskRow[];
  upcomingDeadlines?: TaskRow[];
  nextEvent: EventWithCalendar | null;
  workload: WorkloadSummary | null;
  canvasTasksNeedingEstimates: Array<{
    id: string;
    title: string;
    due_at: string | null;
  }>;
  relatedTasksByEventId: Map<string, RelatedCanvasTask>;
  planningRun: PlanningRunWithProposals | null;
  activeTimer?: ActiveTimerState | null;
  recentActivity?: Array<{ id: string; title: string; completedAt: string }>;
  upcomingReminders?: Array<{
    id: string;
    type: string;
    scheduledFor: string;
  }>;
  pendingReviews?: number;
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
  const daySummary = workload?.daySummaries.find(
    (day) => day.dateKey === todayKey,
  );
  const hoursRemaining = daySummary?.availableFocusMinutes ?? null;
  const isEmpty =
    events.length === 0 &&
    workShifts.length === 0 &&
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
          <Link
            href="/calendar"
            className="mt-1 inline-block text-xs text-accent"
          >
            Open calendar
          </Link>
          <Link
            href="/school"
            className="mt-1 ml-3 inline-block text-xs text-accent"
          >
            School & semester setup
          </Link>
        </div>
        <QuickAddMenu />
      </div>

      {(reviewPrompt && !reviewPrompt.completed) ||
      (dailyPriorities && dailyPriorities.length > 0) ||
      overdue.length > 0 ||
      (inboxCount ?? 0) > 0 ||
      (awaitingFeedbackCount ?? 0) > 0 ||
      pendingReviews > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {reviewPrompt && !reviewPrompt.completed && (
            <Link
              href={`/review/daily?period=${reviewPrompt.period}`}
              className="min-h-11 rounded-xl border border-accent/40 bg-accent/10 p-4 transition-colors hover:border-accent"
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

          {pendingReviews > 0 && (
            <Link
              href="/review/daily"
              className="min-h-11 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
            >
              <p className="text-sm font-medium text-foreground">
                {pendingReviews} pending{" "}
                {pendingReviews === 1 ? "review" : "reviews"}
              </p>
              <p className="mt-1 text-xs text-muted">Continue where you left off</p>
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
            <Link
              href="/inbox"
              className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
            >
              <p className="text-sm font-medium text-foreground">
                {inboxCount} inbox {inboxCount === 1 ? "item" : "items"}
              </p>
              <p className="mt-1 text-xs text-muted">Triage capture queue</p>
            </Link>
          )}

          {(awaitingFeedbackCount ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">
                {awaitingFeedbackCount} planning{" "}
                {awaitingFeedbackCount === 1 ? "block" : "blocks"} need feedback
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeTimer ? (
          <Link
            href="/today?panel=active-timer"
            className="rounded-xl border border-accent/40 bg-accent/10 p-4 transition-colors hover:border-accent"
          >
            <p className="text-xs uppercase tracking-wide text-muted">
              Current timer
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {activeTimer.entry.task_title_snapshot ?? "Untitled task"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {activeTimer.isPaused ? "Paused" : "Running"} ·{" "}
              {formatElapsed(activeTimer.elapsedSeconds)}
            </p>
          </Link>
        ) : null}

        {hoursRemaining != null ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">
              Focus hours remaining
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {formatMinutes(Math.max(0, hoursRemaining))}
            </p>
            <p className="mt-1 text-xs text-muted">
              Available focus time after fixed commitments
            </p>
          </div>
        ) : null}

        {upcomingReminders.length > 0 ? (
          <SectionCard title="Upcoming reminders">
            <ul className="space-y-2">
              {upcomingReminders.map((reminder) => (
                <li key={reminder.id} className="text-sm text-foreground">
                  <span className="capitalize">
                    {reminder.type.replaceAll("_", " ")}
                  </span>
                  <span className="ml-2 text-xs text-muted">
                    {formatAppDate(new Date(reminder.scheduledFor), "MMM d · p")}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/settings/notifications"
              className="mt-2 inline-block text-xs text-accent"
            >
              Notification settings
            </Link>
          </SectionCard>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {workloadError ? (
            <SectionCard title="Weekly workload">
              <InlineRecoverableError
                message={workloadError}
                hint="Try refreshing the page. Workload uses your calendars and availability."
              />
            </SectionCard>
          ) : workload ? (
            <WorkloadSummaryCard
              workload={workload}
              title="Weekly workload summary"
            />
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
                    <span className="ml-2 text-xs text-warning">
                      Estimate needed
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard title="Upcoming deadlines">
            {tasksError ? (
              <InlineRecoverableError message={tasksError} />
            ) : upcomingDeadlines.length === 0 ? (
              <EmptyState
                message="No deadlines in the next 7 days."
                description="Deadlines from tasks with due dates appear here."
                action={{ label: "Add task", href: "/tasks/new" }}
              />
            ) : (
              <ul className="space-y-2">
                {upcomingDeadlines.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/tasks/${task.id}/edit`}
                      className="text-sm text-foreground hover:text-accent"
                    >
                      {task.title}
                    </Link>
                    {task.due_at ? (
                      <span className="ml-2 text-xs text-muted">
                        {formatAppDate(new Date(task.due_at), "MMM d")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
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
              <InlineRecoverableError message={eventsError} />
            ) : events.length === 0 ? (
              <EmptyState
                message="No events scheduled for today."
                description="Calendar events and classes for today show up here."
                action={{ label: "Add event", href: "/events/new" }}
              />
            ) : (
              <div className="space-y-2">
                {allDay.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted">
                      All day
                    </p>
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

          <SectionCard title="Today's work shifts">
            {eventsError ? (
              <InlineRecoverableError message={eventsError} />
            ) : workShifts.length === 0 ? (
              <EmptyState
                message="No work shifts today."
                description="Imported or manual shifts for today appear here."
                action={{ label: "Open work", href: "/work" }}
              />
            ) : (
              <ul className="space-y-2">
                {workShifts.map((shift) => (
                  <li key={shift.id}>
                    <Link
                      href={`/work?date=${getAppLocalDateKey(new Date(shift.start_at))}&event=${shift.id}`}
                      className="text-sm font-medium text-foreground hover:text-accent"
                    >
                      {shift.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {shift.all_day
                        ? "All day"
                        : formatAppTimeRange(shift.start_at, shift.end_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {planningError ? (
        <SectionCard title="Planning proposals">
          <InlineRecoverableError message={planningError} />
        </SectionCard>
      ) : (
        <PlanningControls periodType="day" planningRun={planningRun} />
      )}

      <SectionCard title="Tasks due today">
        {tasksError ? (
          <InlineRecoverableError message={tasksError} />
        ) : dueToday.length === 0 ? (
          <EmptyState
            message="No open tasks due today."
            description="Tasks with today's due date appear here for quick action."
            action={{ label: "Add task", href: "/tasks/new" }}
          />
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
          <InlineRecoverableError message={tasksError} />
        ) : allocatedToday.length === 0 ? (
          <EmptyState
            message="No analytically allocated task work for today."
            description="Run Plan today to propose focus blocks based on workload."
          />
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
          <InlineRecoverableError message={tasksError} />
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

      <SectionCard title="Recent activity">
        {recentActivity.length === 0 ? (
          <EmptyState
            message="No recent completions yet."
            description="Completed tasks show up here so you can see today's progress."
          />
        ) : (
          <ul className="space-y-2">
            {recentActivity.map((item) => (
              <li key={item.id} className="text-sm text-foreground">
                <Link
                  href={`/tasks/${item.id}/edit`}
                  className="hover:text-accent"
                >
                  {item.title}
                </Link>
                <span className="ml-2 text-xs text-muted">
                  {formatAppDate(new Date(item.completedAt), "MMM d · p")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {isEmpty && !eventsError && !tasksError && !workload && (
        <EmptyState
          message="Your day is clear."
          description="Add an event or task to start building today's plan."
          action={{ label: "Add task", href: "/tasks/new" }}
        />
      )}

      {workload?.daySummaries.find((day) => day.dateKey === todayKey) && (
        <p className="text-xs text-muted">
          Workload recommendations are analytical. Use Plan today above to
          propose focus blocks you can accept into LifeOS Planning.
        </p>
      )}
    </div>
  );
}
