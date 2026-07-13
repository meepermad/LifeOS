import type { EventInput } from "@fullcalendar/core";
import type { EventWithCalendar } from "@/lib/data/events";
import {
  canDragEvent,
  canResizeEvent,
  getEditWorkflow,
} from "@/lib/calendar/authorization";
import { getEventVisualStyle } from "@/lib/calendar/visual-metadata";
import type { CalendarRenderEventExtendedProps } from "@/lib/calendar/types";
import { formatAppTime } from "@/lib/dates/timezone";

export type RelatedTaskInfo = {
  id: string;
  title: string;
};

export function eventDurationMinutes(event: EventWithCalendar): number {
  const start = new Date(event.start_at).getTime();
  const end = new Date(event.end_at).getTime();
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function toCalendarRenderEvent(
  event: EventWithCalendar,
  relatedTask?: RelatedTaskInfo | null,
): EventInput {
  const style = getEventVisualStyle(event);
  const editWorkflow = getEditWorkflow(event);
  const editable = canDragEvent(event);
  const durationMinutes = eventDurationMinutes(event);

  const extendedProps: CalendarRenderEventExtendedProps = {
    lifeosId: event.id,
    source: event.source,
    eventType: event.event_type,
    isReadOnly: event.is_read_only,
    editWorkflow,
    visualVariant: style.variant,
    linkedTaskId: event.related_task_id ?? relatedTask?.id ?? null,
    linkedCourseLabel: event.calendar_name,
    blocksTime: event.blocks_time,
    calendarName: event.calendar_name,
    location: event.location,
    status: event.status,
    classMeetingId: event.class_meeting_id,
    durationMinutes,
  };

  const timePrefix = event.all_day ? "" : `${formatAppTime(event.start_at)} `;
  const title = `${style.icon} ${timePrefix}${event.title}`;

  const isDeadlineMarker =
    event.event_type === "deadline" || (event.all_day && event.event_type === "deadline");

  return {
    id: event.id,
    title,
    start: event.start_at,
    end: event.end_at,
    allDay: event.all_day || isDeadlineMarker,
    display: isDeadlineMarker ? "background" : undefined,
    editable,
    durationEditable: canResizeEvent(event),
    startEditable: editable,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    textColor: style.textColor,
    classNames: isDeadlineMarker
      ? [...style.classNames, "lifeos-deadline-marker"]
      : style.classNames,
    extendedProps,
  };
}

export function toCalendarRenderEvents(
  events: EventWithCalendar[],
  relatedTasksByEventId?: Map<string, RelatedTaskInfo>,
): EventInput[] {
  return events.map((event) =>
    toCalendarRenderEvent(event, relatedTasksByEventId?.get(event.id)),
  );
}
