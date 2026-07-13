import { getProfile } from "@/lib/data/bootstrap";
import { listWorkShiftsInRange, applyWorkShiftReconciliation } from "@/lib/data/work-shifts";
import type { EventWithCalendar } from "@/lib/data/events";
import { reconcileWeeklyShifts } from "@/lib/work/shift-reconciliation";
import type { ParsedShift } from "@/lib/work/shift-validation";
import type { ParsedEventTimes } from "@/lib/validation/events";
import { getWeekBounds, splitDateTimeForForm } from "@/lib/dates/timezone";

function buildParsedShiftFromEvent(event: EventWithCalendar): ParsedShift {
  const start = splitDateTimeForForm(event.start_at);
  const end = splitDateTimeForForm(event.end_at);
  const [startH, startM] = start.time.split(":").map(Number);
  const [endH, endM] = end.time.split(":").map(Number);
  const isOvernight =
    endH < startH || (endH === startH && endM <= startM);
  const dateKey =
    event.external_event_id?.replace("work-shift:", "") ?? start.date;

  return {
    dateKey,
    startAt: event.start_at,
    endAt: event.end_at,
    isOvernight,
    unpaidBreakMinutes: event.unpaid_break_minutes ?? 0,
    location: event.location,
    note: event.shift_note,
    title: event.title,
    eventId: event.id,
    requiresConfirmation: false,
  };
}

function buildParsedShiftFromDrop(
  event: EventWithCalendar,
  parsed: ParsedEventTimes,
): ParsedShift {
  const start = splitDateTimeForForm(parsed.startAt);
  const end = splitDateTimeForForm(parsed.endAt);
  const [startH, startM] = start.time.split(":").map(Number);
  const [endH, endM] = end.time.split(":").map(Number);
  const isOvernight =
    endH < startH || (endH === startH && endM <= startM);
  const durationMinutes =
    (new Date(parsed.endAt).getTime() - new Date(parsed.startAt).getTime()) /
    60_000;

  return {
    dateKey: start.date,
    startAt: parsed.startAt,
    endAt: parsed.endAt,
    isOvernight,
    unpaidBreakMinutes: event.unpaid_break_minutes ?? 0,
    location: event.location,
    note: event.shift_note,
    title: event.title,
    eventId: event.id,
    requiresConfirmation: durationMinutes > 12 * 60,
  };
}

export function buildWorkShiftDraftForMove(
  event: EventWithCalendar,
  parsed: ParsedEventTimes,
  existingShifts: EventWithCalendar[],
): ParsedShift[] {
  const movedShift = buildParsedShiftFromDrop(event, parsed);
  return existingShifts.map((shift) =>
    shift.id === event.id ? movedShift : buildParsedShiftFromEvent(shift),
  );
}

export async function moveWorkShiftFromCalendar(
  event: EventWithCalendar,
  parsed: ParsedEventTimes,
): Promise<void> {
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;

  const weekBounds = getWeekBounds(new Date(parsed.startAt), weekStartsOn, 0);
  const existingShifts = await listWorkShiftsInRange(
    weekBounds.start.toISOString(),
    weekBounds.end.toISOString(),
  );

  const draftShifts = buildWorkShiftDraftForMove(event, parsed, existingShifts);

  const { items } = reconcileWeeklyShifts({
    draftShifts,
    existingShifts,
    removeOmitted: false,
  });

  await applyWorkShiftReconciliation(items);
}

export { buildParsedShiftFromEvent, buildParsedShiftFromDrop };
