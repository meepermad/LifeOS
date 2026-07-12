import type { EventWithCalendar } from "@/lib/data/events";
import type { ExpandedClassOccurrence } from "@/lib/academic/meeting-expansion";

export type SemesterConflict = {
  occurrenceDateKey: string;
  classTitle: string;
  message: string;
};

function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA < endB && endA > startB;
}

function isBlockingEvent(event: EventWithCalendar): boolean {
  if (event.status === "cancelled" || event.status === "tentative") return false;
  if (!event.blocks_time) return false;
  if (event.event_type === "deadline") return false;
  if (event.source === "academic") return false;
  return true;
}

export function detectSemesterConflicts(
  occurrences: ExpandedClassOccurrence[],
  allEvents: EventWithCalendar[],
): SemesterConflict[] {
  const conflicts: SemesterConflict[] = [];
  const blocking = allEvents.filter(isBlockingEvent);

  for (const occurrence of occurrences) {
    for (const event of blocking) {
      if (!intervalsOverlap(
        occurrence.startAt,
        occurrence.endAt,
        event.start_at,
        event.end_at,
      )) {
        continue;
      }

      const label =
        event.event_type === "work"
          ? "work shift"
          : event.event_type === "class"
            ? "class"
            : event.event_type;

      conflicts.push({
        occurrenceDateKey: occurrence.dateKey,
        classTitle: occurrence.title,
        message: `${occurrence.title} on ${occurrence.dateKey} overlaps with ${label}: ${event.title}`,
      });
    }
  }

  return conflicts;
}
