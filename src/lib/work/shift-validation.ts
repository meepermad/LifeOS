import { toUtcFromProfileLocal } from "@/lib/dates/timezone";
import { addAppDays } from "@/lib/dates/timezone";
import type { ShiftDayDraft } from "@/lib/work/shift-draft";

export type ParsedShift = {
  dateKey: string;
  startAt: string;
  endAt: string;
  isOvernight: boolean;
  unpaidBreakMinutes: number;
  location: string | null;
  note: string | null;
  title: string;
  eventId?: string;
  requiresConfirmation: boolean;
};

export type ShiftValidationError = {
  dateKey: string;
  message: string;
};

export function parseShiftDay(
  day: ShiftDayDraft,
  timezone: string,
  title = "Work",
): { shift?: ParsedShift; error?: ShiftValidationError } {
  if (day.isOff) {
    return {};
  }

  if (!day.startTime || !day.endTime) {
    return {
      error: {
        dateKey: day.dateKey,
        message: "Start and end times are required for working days.",
      },
    };
  }

  const startAt = toUtcFromProfileLocal(day.dateKey, day.startTime, timezone);
  let endDateKey = day.dateKey;
  const [startH, startM] = day.startTime.split(":").map(Number);
  const [endH, endM] = day.endTime.split(":").map(Number);
  const isOvernight =
    endH < startH || (endH === startH && endM <= startM);

  if (isOvernight) {
    endDateKey = addAppDays(day.dateKey, 1);
  }

  const endAt = toUtcFromProfileLocal(endDateKey, day.endTime, timezone);

  if (endAt.getTime() <= startAt.getTime()) {
    return {
      error: {
        dateKey: day.dateKey,
        message: "Shift must have a positive duration.",
      },
    };
  }

  const durationMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;
  if (day.unpaidBreakMinutes >= durationMinutes) {
    return {
      error: {
        dateKey: day.dateKey,
        message: "Break duration must be shorter than the shift.",
      },
    };
  }

  return {
    shift: {
      dateKey: day.dateKey,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      isOvernight,
      unpaidBreakMinutes: day.unpaidBreakMinutes,
      location: day.location.trim() || null,
      note: day.note.trim() || null,
      title,
      eventId: day.eventId,
      requiresConfirmation: durationMinutes > 12 * 60,
    },
  };
}

export function parseWeeklyDraft(
  days: ShiftDayDraft[],
  timezone: string,
): { shifts: ParsedShift[]; errors: ShiftValidationError[] } {
  const shifts: ParsedShift[] = [];
  const errors: ShiftValidationError[] = [];

  for (const day of days) {
    const result = parseShiftDay(day, timezone);
    if (result.error) errors.push(result.error);
    else if (result.shift) shifts.push(result.shift);
  }

  return { shifts, errors };
}
