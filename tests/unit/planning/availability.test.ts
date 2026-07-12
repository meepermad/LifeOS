import { describe, expect, it } from "vitest";
import {
  availabilityMinutesForDay,
  buildAvailabilityIntervalsForDay,
  hasEnabledAvailabilityForDay,
} from "@/lib/planning/availability";
import { mergeIntervals, totalDurationMinutes } from "@/lib/planning/intervals";
import { getDayBoundsInUtc } from "@/lib/dates/timezone";

describe("availability", () => {
  const rules = [
    {
      dayOfWeek: 1,
      availableStart: "09:00:00",
      availableEnd: "12:00:00",
      isEnabled: true,
    },
    {
      dayOfWeek: 1,
      availableStart: "11:00:00",
      availableEnd: "17:00:00",
      isEnabled: true,
    },
  ];

  it("merges overlapping availability windows", () => {
    const intervals = buildAvailabilityIntervalsForDay("2026-07-13", rules);
    const merged = mergeIntervals(intervals);
    expect(totalDurationMinutes(merged)).toBe(8 * 60);
  });

  it("returns zero when no enabled rules exist", () => {
    const { start, end } = getDayBoundsInUtc("2026-07-12");
    const minutes = availabilityMinutesForDay("2026-07-12", rules, start, end);
    expect(minutes).toBe(0);
    expect(hasEnabledAvailabilityForDay("2026-07-12", rules)).toBe(false);
  });
});
