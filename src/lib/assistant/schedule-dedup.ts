import type { EventWithCalendar } from "@/lib/data/events";

function eventWindowKey(event: EventWithCalendar): string {
  return `${event.start_at}|${event.end_at}`;
}

function isCanvasClass(event: EventWithCalendar): boolean {
  return (
    event.event_type === "class" &&
    (event.source === "canvas" || event.calendar_source === "canvas")
  );
}

function isAcademicClass(event: EventWithCalendar): boolean {
  return event.source === "academic" && event.event_type === "class";
}

function isWorkScheduleEvent(event: EventWithCalendar): boolean {
  return event.source === "work_schedule" && event.event_type === "work";
}

export function deduplicateScheduleEvents(input: {
  events: EventWithCalendar[];
  suppressedCanvasUids?: Set<string>;
  archivedMeetingIds?: Set<string>;
  rejectedFocusBlockEventIds?: Set<string>;
}): EventWithCalendar[] {
  const {
    events,
    suppressedCanvasUids = new Set(),
    archivedMeetingIds = new Set(),
    rejectedFocusBlockEventIds = new Set(),
  } = input;

  const filtered = events.filter((event) => {
    if (event.status === "cancelled") return false;
    if (
      event.class_meeting_id &&
      archivedMeetingIds.has(event.class_meeting_id)
    ) {
      return false;
    }
    if (
      event.event_type === "focus_block" &&
      rejectedFocusBlockEventIds.has(event.id)
    ) {
      return false;
    }
    if (
      isCanvasClass(event) &&
      event.external_event_id &&
      suppressedCanvasUids.has(event.external_event_id)
    ) {
      return false;
    }
    return true;
  });

  const academicByWindow = new Map<string, EventWithCalendar>();
  for (const event of filtered) {
    if (isAcademicClass(event)) {
      academicByWindow.set(eventWindowKey(event), event);
    }
  }

  const workScheduleByWindow = new Map<string, EventWithCalendar>();
  for (const event of filtered) {
    if (isWorkScheduleEvent(event)) {
      workScheduleByWindow.set(eventWindowKey(event), event);
    }
  }

  return filtered.filter((event) => {
    if (isCanvasClass(event)) {
      const academic = academicByWindow.get(eventWindowKey(event));
      if (academic) return false;
    }
    if (
      event.event_type === "work" &&
      event.source !== "work_schedule" &&
      workScheduleByWindow.has(eventWindowKey(event))
    ) {
      return false;
    }
    return true;
  });
}
