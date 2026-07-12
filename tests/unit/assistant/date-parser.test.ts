import { describe, expect, it } from "vitest";
import {
  extractDateFromText,
  parseRelativeDate,
  parseTimeRange,
} from "@/lib/assistant/date-parser";
import { toUtcFromAppLocal, getAppLocalDateKey } from "@/lib/dates/timezone";

describe("date-parser", () => {
  const monday = new Date("2026-07-13T17:00:00.000Z");

  it("interprets today in America/Chicago", () => {
    const result = parseRelativeDate("today", monday);
    expect(result?.dateKey).toBe(getAppLocalDateKey(monday));
  });

  it("interprets tomorrow", () => {
    const result = parseRelativeDate("tomorrow", monday);
    expect(result?.label).toBe("tomorrow");
    expect(result?.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses weekday names as next occurrence", () => {
    const wednesday = extractDateFromText("Wednesday", monday);
    expect(wednesday?.dateKey).toBe("2026-07-15");
  });

  it("parses time ranges", () => {
    const range = parseTimeRange("from 3 to 4 PM");
    expect(range).toEqual({ startTime: "15:00", endTime: "16:00" });
  });

  it("handles DST spring forward boundary safely", () => {
    const springSunday = new Date("2026-03-08T12:00:00.000Z");
    const result = parseRelativeDate("today", springSunday);
    expect(result?.dateKey).toBeTruthy();
    expect(() => toUtcFromAppLocal("2026-03-08", "02:30")).toThrow();
  });

  it("handles DST fall back round-trip", () => {
    const fallDate = toUtcFromAppLocal("2026-11-01", "10:30");
    expect(fallDate.toISOString()).toBeTruthy();
  });
});
