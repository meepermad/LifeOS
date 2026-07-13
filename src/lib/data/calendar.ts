import { listEventsInRange } from "@/lib/data/events";
import { listTasks } from "@/lib/data/tasks";
import { applyCalendarFilters } from "@/lib/calendar/filters";
import { toCalendarRenderEvents } from "@/lib/calendar/adapters/render-event";
import type { CalendarFilterPrefs } from "@/lib/calendar/types";
import type { EventInput } from "@fullcalendar/core";
import type { EventWithCalendar } from "@/lib/data/events";

export type CalendarEventsPayload = {
  events: EventInput[];
  eventCount: number;
  eventRecords: EventWithCalendar[];
};

export async function loadCalendarEvents(input: {
  start: string;
  end: string;
  filters: CalendarFilterPrefs;
}): Promise<CalendarEventsPayload> {
  const rawEvents = await listEventsInRange(input.start, input.end, {
    includeCancelled: input.filters.showCancelled ?? false,
  });

  const filtered = applyCalendarFilters(rawEvents, input.filters);

  const relatedEventIds = filtered
    .filter((e) => e.event_type === "deadline")
    .map((e) => e.id);

  const relatedTasksByEventId = new Map<string, { id: string; title: string }>();

  if (relatedEventIds.length > 0) {
    const tasks = await listTasks({ status: "active" });
    for (const task of tasks) {
      if (task.related_event_id && relatedEventIds.includes(task.related_event_id)) {
        relatedTasksByEventId.set(task.related_event_id, {
          id: task.id,
          title: task.title,
        });
      }
    }
  }

  const events = toCalendarRenderEvents(filtered, relatedTasksByEventId);

  return {
    events,
    eventCount: events.length,
    eventRecords: filtered,
  };
}
