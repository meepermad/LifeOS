import type { EventWithCalendar } from "@/lib/data/events";
import type { ParsedShift } from "@/lib/work/shift-validation";
import { workShiftExternalId } from "@/lib/work/shift-draft";

export type ShiftReconciliationItem = {
  dateKey: string;
  action: "created" | "updated" | "unchanged" | "removed";
  shift?: ParsedShift;
  eventId?: string;
};

export type OmittedShift = {
  eventId: string;
  dateKey: string;
  startAt: string;
  endAt: string;
};

function shiftsEqual(existing: EventWithCalendar, shift: ParsedShift): boolean {
  return (
    existing.start_at === shift.startAt &&
    existing.end_at === shift.endAt &&
    (existing.unpaid_break_minutes ?? 0) === shift.unpaidBreakMinutes &&
    (existing.location ?? "") === (shift.location ?? "") &&
    (existing.shift_note ?? "") === (shift.note ?? "") &&
    existing.title === shift.title
  );
}

export function reconcileWeeklyShifts(input: {
  draftShifts: ParsedShift[];
  existingShifts: EventWithCalendar[];
  removeOmitted: boolean;
}): {
  items: ShiftReconciliationItem[];
  omitted: OmittedShift[];
} {
  const existingByDate = new Map<string, EventWithCalendar>();
  const existingById = new Map<string, EventWithCalendar>();

  for (const event of input.existingShifts) {
    const dateKey =
      event.external_event_id?.replace("work-shift:", "") ??
      event.start_at.slice(0, 10);
    existingByDate.set(dateKey, event);
    existingById.set(event.id, event);
  }

  const items: ShiftReconciliationItem[] = [];
  const touchedIds = new Set<string>();

  for (const shift of input.draftShifts) {
    const existing =
      (shift.eventId ? existingById.get(shift.eventId) : undefined) ??
      existingByDate.get(shift.dateKey);

    if (!existing) {
      items.push({ dateKey: shift.dateKey, action: "created", shift });
      continue;
    }

    touchedIds.add(existing.id);

    if (shiftsEqual(existing, shift)) {
      items.push({
        dateKey: shift.dateKey,
        action: "unchanged",
        shift,
        eventId: existing.id,
      });
    } else {
      items.push({
        dateKey: shift.dateKey,
        action: "updated",
        shift: { ...shift, eventId: existing.id },
        eventId: existing.id,
      });
    }
  }

  const omitted: OmittedShift[] = [];
  for (const event of input.existingShifts) {
    if (touchedIds.has(event.id)) continue;
    const dateKey =
      event.external_event_id?.replace("work-shift:", "") ??
      event.start_at.slice(0, 10);
    omitted.push({
      eventId: event.id,
      dateKey,
      startAt: event.start_at,
      endAt: event.end_at,
    });
    if (input.removeOmitted) {
      items.push({
        dateKey,
        action: "removed",
        eventId: event.id,
      });
    }
  }

  return { items, omitted };
}

export function buildShiftExternalId(dateKey: string): string {
  return workShiftExternalId(dateKey);
}
