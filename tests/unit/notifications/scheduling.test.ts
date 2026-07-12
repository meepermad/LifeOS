import { describe, expect, it } from "vitest";
import {
  buildDailyDedupKey,
  buildWeeklyDedupKey,
  isInQuietHours,
  isScheduledTimeInWindow,
  isScheduledTimeStale,
} from "@/lib/notifications/scheduling";

describe("scheduling helpers", () => {
  it("builds stable daily dedup keys", () => {
    expect(buildDailyDedupKey("user-1", "2026-07-12")).toBe(
      "daily_agenda:user-1:2026-07-12",
    );
  });

  it("builds stable weekly dedup keys", () => {
    expect(buildWeeklyDedupKey("user-1", "2026-07-07")).toBe(
      "weekly_summary:user-1:2026-07-07",
    );
  });

  it("detects scheduled time in 15-minute window", () => {
    expect(isScheduledTimeInWindow("08:05:00", 480, 495)).toBe(true);
    expect(isScheduledTimeInWindow("08:30:00", 480, 495)).toBe(false);
  });

  it("skips stale delivery outside window", () => {
    expect(isScheduledTimeStale("07:45:00", 480)).toBe(true);
    expect(isScheduledTimeStale("08:30:00", 480)).toBe(false);
  });

  it("handles quiet hours within same day", () => {
    expect(isInQuietHours(23 * 60, "22:00:00", "07:00:00")).toBe(true);
    expect(isInQuietHours(12 * 60, "22:00:00", "07:00:00")).toBe(false);
  });

  it("handles quiet hours crossing midnight", () => {
    expect(isInQuietHours(23 * 60, "22:00:00", "07:00:00")).toBe(true);
    expect(isInQuietHours(6 * 60, "22:00:00", "07:00:00")).toBe(true);
    expect(isInQuietHours(12 * 60, "22:00:00", "07:00:00")).toBe(false);
  });
});
