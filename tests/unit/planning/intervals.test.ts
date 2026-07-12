import { describe, expect, it } from "vitest";
import {
  clipInterval,
  expandInterval,
  mergeIntervals,
  subtractIntervals,
  toInterval,
  totalDurationMinutes,
} from "@/lib/planning/intervals";

describe("intervals", () => {
  it("merges overlapping intervals", () => {
    const merged = mergeIntervals([
      { startMs: 0, endMs: 120 * 60_000 },
      { startMs: 60 * 60_000, endMs: 180 * 60_000 },
    ]);

    expect(totalDurationMinutes(merged)).toBe(180);
  });

  it("merges adjacent intervals", () => {
    const merged = mergeIntervals([
      { startMs: 0, endMs: 60 * 60_000 },
      { startMs: 60 * 60_000, endMs: 120 * 60_000 },
    ]);

    expect(merged).toHaveLength(1);
    expect(totalDurationMinutes(merged)).toBe(120);
  });

  it("clips intervals to bounds", () => {
    const clipped = clipInterval(
      { startMs: 0, endMs: 120 * 60_000 },
      { startMs: 30 * 60_000, endMs: 90 * 60_000 },
    );

    expect(totalDurationMinutes([clipped!])).toBe(60);
  });

  it("does not double-count overlapping events when subtracting", () => {
    const availability = [{ startMs: 0, endMs: 8 * 60 * 60_000 }];
    const blocking = mergeIntervals([
      { startMs: 1 * 60 * 60_000, endMs: 3 * 60 * 60_000 },
      { startMs: 2 * 60 * 60_000, endMs: 4 * 60 * 60_000 },
    ]);

    const open = subtractIntervals(availability, blocking);
    expect(totalDurationMinutes(open)).toBe(5 * 60);
  });

  it("expands intervals for travel buffer once", () => {
    const expanded = expandInterval(
      { startMs: 60 * 60_000, endMs: 120 * 60_000 },
      15,
    );

    expect(totalDurationMinutes([expanded])).toBe(90);
  });
});

describe("DST boundaries", () => {
  it("handles America/Chicago spring-forward day keys", () => {
    const interval = toInterval(
      "2026-03-08T08:00:00.000Z",
      "2026-03-08T15:00:00.000Z",
    );
    expect(interval.endMs).toBeGreaterThan(interval.startMs);
  });
});
