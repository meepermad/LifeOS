import Link from "next/link";
import {
  formatAppDate,
  formatAppTimeRange,
  getAppLocalDateKey,
} from "@/lib/dates/timezone";
import { EVENT_TYPES } from "@/lib/constants";
import type { EventWithCalendar } from "@/lib/data/events";
import type { DayWorkloadSummary } from "@/lib/planning/types";
import { formatMinutes } from "@/lib/planning/summaries";
import { CanvasDeadlineAction } from "@/components/events/canvas-deadline-action";
import { WorkloadStatusBadge } from "@/components/workload/workload-status-badge";
import { EmptyState } from "@/components/forms/ui";

export type RelatedCanvasTask = {
  id: string;
  missingEstimate: boolean;
};

function eventTypeLabel(value: string): string {
  return EVENT_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function EventListItem({
  event,
  relatedTask,
}: {
  event: EventWithCalendar;
  relatedTask?: RelatedCanvasTask | null;
}) {
  const editable = !event.is_read_only;
  const isCanvasDeadline =
    (event.source === "canvas" || event.calendar_source === "canvas") &&
    event.event_type === "deadline";

  return (
    <article className="rounded-lg border border-border/70 bg-surface-elevated/40 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editable ? (
            <Link
              href={`/events/${event.id}/edit`}
              className="font-medium text-foreground hover:text-accent"
            >
              {event.title}
            </Link>
          ) : (
            <p className="font-medium text-foreground">{event.title}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            {event.all_day
              ? "All day"
              : formatAppTimeRange(event.start_at, event.end_at)}
            {" · "}
            {event.event_type === "deadline" ? "Deadline" : eventTypeLabel(event.event_type)}
            {" · "}
            {event.calendar_name}
          </p>

          {isCanvasDeadline && relatedTask && !relatedTask.missingEstimate && (
            <Link
              href={`/tasks/${relatedTask.id}/edit`}
              className="mt-2 inline-flex text-xs text-accent hover:underline"
            >
              Linked task
            </Link>
          )}

          {isCanvasDeadline && relatedTask && relatedTask.missingEstimate && (
            <CanvasDeadlineAction
              eventId={event.id}
              taskId={relatedTask.id}
              eventTitle={event.title}
            />
          )}

          {isCanvasDeadline && !relatedTask && (
            <p className="mt-2 text-xs text-muted">
              Sync Canvas to link this assignment.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {(event.source === "canvas" || event.calendar_source === "canvas") && (
            <span className="text-xs font-medium text-accent">Canvas</span>
          )}
          {event.is_read_only && (
            <span className="text-xs text-muted">Read-only</span>
          )}
        </div>
      </div>
    </article>
  );
}

function DayWorkloadMetrics({ day }: { day?: DayWorkloadSummary }) {
  if (!day) return null;

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-muted">Fixed</p>
        <p className="font-medium text-foreground">{formatMinutes(day.fixedMinutes)}</p>
      </div>
      <div>
        <p className="text-muted">Available focus</p>
        <p className="font-medium text-foreground">
          {formatMinutes(day.availableFocusMinutes)}
        </p>
      </div>
      <div>
        <p className="text-muted">Recommended tasks</p>
        <p className="font-medium text-foreground">
          {formatMinutes(day.recommendedTaskMinutes)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <WorkloadStatusBadge status={day.status} />
      </div>
    </div>
  );
}

export function WeekAgenda({
  dayKeys,
  eventsByDay,
  daySummaries,
  relatedTasksByEventId,
}: {
  dayKeys: string[];
  eventsByDay: Map<string, EventWithCalendar[]>;
  daySummaries?: Map<string, DayWorkloadSummary>;
  relatedTasksByEventId?: Map<string, RelatedCanvasTask>;
}) {
  const hasEvents = dayKeys.some((key) => (eventsByDay.get(key)?.length ?? 0) > 0);

  if (!hasEvents && !daySummaries) {
    return <EmptyState message="No events this week. Create one to get started." />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {dayKeys.map((dayKey) => {
        const events = eventsByDay.get(dayKey) ?? [];
        const allDay = events.filter((event) => event.all_day);
        const timed = events.filter((event) => !event.all_day);
        const daySummary = daySummaries?.get(dayKey);

        return (
          <section key={dayKey} className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-foreground">
              {formatAppDate(dayKey, "EEEE, MMM d")}
            </h2>

            <DayWorkloadMetrics day={daySummary} />

            {events.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No events</p>
            ) : (
              <div className="mt-3 space-y-2">
                {allDay.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted">All day</p>
                    {allDay.map((event) => (
                      <EventListItem
                        key={event.id}
                        event={event}
                        relatedTask={relatedTasksByEventId?.get(event.id)}
                      />
                    ))}
                  </div>
                )}
                {timed.map((event) => (
                  <EventListItem
                    key={event.id}
                    event={event}
                    relatedTask={relatedTasksByEventId?.get(event.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function groupEventsByAppDay(
  events: EventWithCalendar[],
): Map<string, EventWithCalendar[]> {
  const grouped = new Map<string, EventWithCalendar[]>();

  for (const event of events) {
    const key = getAppLocalDateKey(event.start_at);
    const existing = grouped.get(key) ?? [];
    existing.push(event);
    grouped.set(key, existing);
  }

  for (const [, dayEvents] of grouped) {
    dayEvents.sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
  }

  return grouped;
}
