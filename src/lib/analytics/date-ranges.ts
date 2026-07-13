import {
  addAppDays,
  formatAppDate,
  getAppLocalDateKey,
  getTodayBoundsUtc,
  getWeekBounds,
  nowInAppTimezone,
  toUtcEndOfAppLocalDay,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import type { InsightsDateRange } from "@/lib/data/insights";

export type InsightsRangePreset =
  | "this_week"
  | "last_week"
  | "last_4_weeks"
  | "this_semester"
  | "custom";

export function resolveInsightsRange(input: {
  preset: InsightsRangePreset;
  weekStartsOn: 0 | 1;
  customStart?: string;
  customEnd?: string;
}): InsightsDateRange {
  const now = nowInAppTimezone();

  if (input.preset === "this_week") {
    const { start, end } = getWeekBounds(now, input.weekStartsOn, 0);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label: "This week",
    };
  }

  if (input.preset === "last_week") {
    const { start, end } = getWeekBounds(now, input.weekStartsOn, -1);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label: "Last week",
    };
  }

  if (input.preset === "last_4_weeks") {
    const { start } = getWeekBounds(now, input.weekStartsOn, -3);
    const { end } = getWeekBounds(now, input.weekStartsOn, 0);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label: "Last 4 weeks",
    };
  }

  if (input.preset === "custom" && input.customStart && input.customEnd) {
    return {
      start: toUtcFromAppLocalDate(input.customStart).toISOString(),
      end: toUtcEndOfAppLocalDay(input.customEnd).toISOString(),
      label: `${formatAppDate(input.customStart, "MMM d")} – ${formatAppDate(input.customEnd, "MMM d")}`,
    };
  }

  const today = getTodayBoundsUtc();
  return {
    start: today.start.toISOString(),
    end: today.end.toISOString(),
    label: "Today",
  };
}
