import { addDays, endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import type { CalendarViewId } from "@/lib/calendar/types";

export type VisibleRange = {
  start: string;
  end: string;
  queryStart: string;
  queryEnd: string;
};

function toUtcIso(zonedDate: Date, timezone: string): string {
  return fromZonedTime(
    format(zonedDate, "yyyy-MM-dd'T'HH:mm:ss"),
    timezone,
  ).toISOString();
}

export function getVisibleRangeForView(input: {
  view: CalendarViewId;
  anchorDate: string;
  weekStartsOn: 0 | 1;
  timezone: string;
  bufferDays?: number;
}): VisibleRange {
  const { view, anchorDate, weekStartsOn, timezone } = input;
  const bufferDays = input.bufferDays ?? 1;
  const anchor = toZonedTime(new Date(`${anchorDate}T12:00:00`), timezone);

  let rangeStart: Date;
  let rangeEnd: Date;

  switch (view) {
    case "month": {
      rangeStart = startOfMonth(anchor);
      rangeEnd = endOfMonth(anchor);
      break;
    }
    case "week": {
      rangeStart = startOfWeek(anchor, { weekStartsOn });
      rangeEnd = endOfWeek(anchor, { weekStartsOn });
      break;
    }
    case "threeDay": {
      rangeStart = startOfDay(anchor);
      rangeEnd = endOfDay(addDays(anchor, 2));
      break;
    }
    case "day": {
      rangeStart = startOfDay(anchor);
      rangeEnd = endOfDay(anchor);
      break;
    }
    case "agenda": {
      rangeStart = startOfWeek(anchor, { weekStartsOn });
      rangeEnd = endOfWeek(anchor, { weekStartsOn });
      break;
    }
    default: {
      rangeStart = startOfWeek(anchor, { weekStartsOn });
      rangeEnd = endOfWeek(anchor, { weekStartsOn });
    }
  }

  const queryStart = addDays(rangeStart, -bufferDays);
  const queryEnd = addDays(rangeEnd, bufferDays);

  return {
    start: toUtcIso(rangeStart, timezone),
    end: toUtcIso(rangeEnd, timezone),
    queryStart: toUtcIso(startOfDay(queryStart), timezone),
    queryEnd: toUtcIso(endOfDay(queryEnd), timezone),
  };
}

export function formatHourForSlot(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00:00`;
}
