import { toUtcFromProfileLocal } from "@/lib/dates/timezone";
import { addAppDays } from "@/lib/dates/timezone";
import type { DayShiftDraft, ShiftSlotDraft } from "@/lib/work/shift-draft";

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
  workProfileId?: string | null;
  externalEventId?: string;
  clientId?: string;
  requiresConfirmation: boolean;
};

export type ShiftValidationError = {
  dateKey: string;
  message: string;
};

export function parseShiftSlot(
  slot: ShiftSlotDraft,
  timezone: string,
  title = "Work",
): { shift?: ParsedShift; error?: ShiftValidationError } {
  if (!slot.startTime || !slot.endTime) {
    return {
      error: {
        dateKey: slot.dateKey,
        message: "Start and end times are required for every shift.",
      },
    };
  }

  const startAt = toUtcFromProfileLocal(slot.dateKey, slot.startTime, timezone);
  let endDateKey = slot.dateKey;
  const [startH, startM] = slot.startTime.split(":").map(Number);
  const [endH, endM] = slot.endTime.split(":").map(Number);
  const isOvernight =
    endH < startH || (endH === startH && endM <= startM);

  if (isOvernight) {
    endDateKey = addAppDays(slot.dateKey, 1);
  }

  const endAt = toUtcFromProfileLocal(endDateKey, slot.endTime, timezone);

  if (endAt.getTime() <= startAt.getTime()) {
    return {
      error: {
        dateKey: slot.dateKey,
        message: "Shift must have a positive duration.",
      },
    };
  }

  const durationMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;
  if (slot.unpaidBreakMinutes >= durationMinutes) {
    return {
      error: {
        dateKey: slot.dateKey,
        message: "Break duration must be shorter than the shift.",
      },
    };
  }

  return {
    shift: {
      dateKey: slot.dateKey,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      isOvernight,
      unpaidBreakMinutes: slot.unpaidBreakMinutes,
      location: slot.location.trim() || null,
      note: slot.note.trim() || null,
      title: slot.displayTitle?.trim() || title,
      eventId: slot.eventId,
      workProfileId: slot.workProfileId,
      externalEventId: slot.externalEventId,
      clientId: slot.clientId,
      requiresConfirmation: durationMinutes > 12 * 60,
    },
  };
}

export function parseWeeklyDraft(
  days: DayShiftDraft[],
  timezone: string,
  profileDisplayNames: Record<string, string> = {},
): { shifts: ParsedShift[]; errors: ShiftValidationError[] } {
  const shifts: ParsedShift[] = [];
  const errors: ShiftValidationError[] = [];

  for (const day of days) {
    for (const slot of day.shifts) {
      const normalizedSlot = { ...slot, dateKey: day.dateKey };
      const title =
        (normalizedSlot.workProfileId
          ? profileDisplayNames[normalizedSlot.workProfileId]
          : undefined) ?? "Work";
      const result = parseShiftSlot(normalizedSlot, timezone, title);
      if (result.error) errors.push(result.error);
      else if (result.shift) shifts.push(result.shift);
    }
  }

  return { shifts, errors };
}

/** @deprecated Use `parseShiftSlot`. */
export const parseShiftDay = parseShiftSlot;
