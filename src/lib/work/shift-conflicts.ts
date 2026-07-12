import type { EventWithCalendar } from "@/lib/data/events";
import type { ParsedShift } from "@/lib/work/shift-validation";
import { toPlanningEvent } from "@/lib/planning/mappers";

export type ShiftConflict = {
  shiftDateKey: string;
  message: string;
};

function isBlockingEvent(event: EventWithCalendar, excludeEventId?: string): boolean {
  if (event.id === excludeEventId) return false;
  const planning = toPlanningEvent(event);
  if (planning.status === "cancelled" || planning.status === "tentative") {
    return false;
  }
  if (planning.eventType === "deadline" || !planning.blocksTime) {
    return false;
  }
  return true;
}

function formatConflictLabel(event: EventWithCalendar): string {
  if (event.event_type === "class") {
    return event.title;
  }
  if (event.event_type === "work" && event.calendar_name === "Work") {
    return "an existing work shift";
  }
  if (event.event_type === "focus_block") {
    return "an accepted planning block";
  }
  if (event.sensitivity === "private" || event.sensitivity === "confidential") {
    return "an existing calendar event";
  }
  return event.title || "an existing calendar event";
}

function overlaps(
  startMs: number,
  endMs: number,
  eventStart: string,
  eventEnd: string,
): boolean {
  const eventStartMs = new Date(eventStart).getTime();
  const eventEndMs = new Date(eventEnd).getTime();
  return eventStartMs < endMs && eventEndMs > startMs;
}

export function detectShiftConflicts(
  shifts: ParsedShift[],
  events: EventWithCalendar[],
): ShiftConflict[] {
  const conflicts: ShiftConflict[] = [];

  for (const shift of shifts) {
    const startMs = new Date(shift.startAt).getTime();
    const endMs = new Date(shift.endAt).getTime();

    for (const event of events) {
      if (!isBlockingEvent(event, shift.eventId)) continue;
      if (!overlaps(startMs, endMs, event.start_at, event.end_at)) continue;

      const label = formatConflictLabel(event);
      conflicts.push({
        shiftDateKey: shift.dateKey,
        message: `${shift.dateKey} shift overlaps ${label}.`,
      });
    }
  }

  return conflicts;
}
