export type ShiftSlotDraft = {
  clientId: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  location: string;
  note: string;
  eventId?: string;
  workProfileId?: string | null;
  externalEventId?: string;
  displayTitle?: string;
};

export type DayShiftDraft = {
  dateKey: string;
  shifts: ShiftSlotDraft[];
};

export type WeeklyShiftDraft = {
  weekStartKey: string;
  days: DayShiftDraft[];
};

export function createEmptyWeeklyDraft(
  weekStartKey: string,
  dayKeys: string[],
): WeeklyShiftDraft {
  return {
    weekStartKey,
    days: dayKeys.map((dateKey) => ({
      dateKey,
      shifts: [],
    })),
  };
}

export function createEmptySlot(dateKey: string): ShiftSlotDraft {
  return {
    clientId: crypto.randomUUID(),
    dateKey,
    startTime: "",
    endTime: "",
    unpaidBreakMinutes: 0,
    location: "",
    note: "",
  };
}

export function newWorkShiftExternalId(): string {
  return `work-shift:${crypto.randomUUID()}`;
}

export function flattenDraftDays(days: DayShiftDraft[]): ShiftSlotDraft[] {
  return days.flatMap((day) =>
    day.shifts.map((shift) => ({ ...shift, dateKey: day.dateKey })),
  );
}

/** @deprecated New shifts must use `newWorkShiftExternalId()` instead. */
export function workShiftExternalId(_dateKey: string): string {
  return newWorkShiftExternalId();
}
