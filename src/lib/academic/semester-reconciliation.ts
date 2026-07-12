import type { EventWithCalendar } from "@/lib/data/events";
import type { ExpandedClassOccurrence } from "@/lib/academic/meeting-expansion";
import { buildAcademicExternalId, parseAcademicExternalId } from "@/lib/academic/meeting-expansion";

export type SemesterReconciliationItem = {
  dateKey: string;
  classMeetingId: string;
  action: "created" | "updated" | "unchanged" | "removed";
  occurrence?: ExpandedClassOccurrence;
  eventId?: string;
};

export type OmittedClassEvent = {
  eventId: string;
  dateKey: string;
  classMeetingId: string;
  startAt: string;
  endAt: string;
};

function occurrencesEqual(
  existing: EventWithCalendar,
  occurrence: ExpandedClassOccurrence,
): boolean {
  return (
    existing.start_at === occurrence.startAt &&
    existing.end_at === occurrence.endAt &&
    existing.title === occurrence.title &&
    (existing.location ?? "") === (occurrence.location ?? "") &&
    existing.content_hash === occurrence.contentHash
  );
}

export function reconcileSemesterOccurrences(input: {
  desiredOccurrences: ExpandedClassOccurrence[];
  existingEvents: EventWithCalendar[];
  removeOmitted: boolean;
}): {
  items: SemesterReconciliationItem[];
  omitted: OmittedClassEvent[];
} {
  const existingByKey = new Map<string, EventWithCalendar>();

  for (const event of input.existingEvents) {
    if (!event.external_event_id) continue;
    const parsed = parseAcademicExternalId(event.external_event_id);
    if (!parsed) continue;
    existingByKey.set(
      `${parsed.classMeetingId}:${parsed.dateKey}`,
      event,
    );
  }

  const items: SemesterReconciliationItem[] = [];
  const touchedIds = new Set<string>();

  for (const occurrence of input.desiredOccurrences) {
    const key = `${occurrence.classMeetingId}:${occurrence.dateKey}`;
    const existing = existingByKey.get(key);

    if (!existing) {
      items.push({
        dateKey: occurrence.dateKey,
        classMeetingId: occurrence.classMeetingId,
        action: "created",
        occurrence,
      });
      continue;
    }

    touchedIds.add(existing.id);

    if (occurrencesEqual(existing, occurrence)) {
      items.push({
        dateKey: occurrence.dateKey,
        classMeetingId: occurrence.classMeetingId,
        action: "unchanged",
        occurrence,
        eventId: existing.id,
      });
    } else {
      items.push({
        dateKey: occurrence.dateKey,
        classMeetingId: occurrence.classMeetingId,
        action: "updated",
        occurrence,
        eventId: existing.id,
      });
    }
  }

  const omitted: OmittedClassEvent[] = [];
  for (const event of input.existingEvents) {
    if (touchedIds.has(event.id)) continue;
    const parsed = parseAcademicExternalId(event.external_event_id ?? "");
    if (!parsed) continue;
    omitted.push({
      eventId: event.id,
      dateKey: parsed.dateKey,
      classMeetingId: parsed.classMeetingId,
      startAt: event.start_at,
      endAt: event.end_at,
    });
    if (input.removeOmitted) {
      items.push({
        dateKey: parsed.dateKey,
        classMeetingId: parsed.classMeetingId,
        action: "removed",
        eventId: event.id,
      });
    }
  }

  return { items, omitted };
}

export { buildAcademicExternalId };
