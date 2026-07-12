export type ShiftDayDraft = {
  dateKey: string;
  isOff: boolean;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  location: string;
  note: string;
  eventId?: string;
};

export type WeeklyShiftDraft = {
  weekStartKey: string;
  days: ShiftDayDraft[];
};

export function createEmptyWeeklyDraft(
  weekStartKey: string,
  dayKeys: string[],
): WeeklyShiftDraft {
  return {
    weekStartKey,
    days: dayKeys.map((dateKey) => ({
      dateKey,
      isOff: true,
      startTime: "",
      endTime: "",
      unpaidBreakMinutes: 0,
      location: "",
      note: "",
    })),
  };
}

export function workShiftExternalId(dateKey: string): string {
  return `work-shift:${dateKey}`;
}
