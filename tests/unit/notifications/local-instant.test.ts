import { describe, expect, it } from "vitest";
import {
  isValidIanaTimeZone,
  parseLocalWallClockTime,
  resolveLocalNotificationInstant,
  toUtcFromProfileLocal,
} from "@/lib/dates/timezone";

describe("resolveLocalNotificationInstant", () => {
  it("accepts HH:MM", () => {
    const instant = resolveLocalNotificationInstant({
      localDate: "2026-07-14",
      localTime: "13:00",
      timezone: "America/Chicago",
    });
    expect(instant.toISOString()).toBe("2026-07-14T18:00:00.000Z");
  });

  it("accepts HH:MM:SS", () => {
    const instant = resolveLocalNotificationInstant({
      localDate: "2026-07-14",
      localTime: "13:00:00",
      timezone: "America/Chicago",
    });
    expect(instant.toISOString()).toBe("2026-07-14T18:00:00.000Z");
  });

  it("rejects invalid times", () => {
    expect(() =>
      parseLocalWallClockTime("25:00"),
    ).toThrow(/Invalid local time/);
    expect(() =>
      resolveLocalNotificationInstant({
        localDate: "2026-07-14",
        localTime: "13:00:00:00",
        timezone: "America/Chicago",
      }),
    ).toThrow(/Invalid local time/);
  });

  it("rejects invalid timezones", () => {
    expect(isValidIanaTimeZone("America/Chicago")).toBe(true);
    expect(isValidIanaTimeZone("Not/A_Zone")).toBe(false);
    expect(() =>
      resolveLocalNotificationInstant({
        localDate: "2026-07-14",
        localTime: "13:00",
        timezone: "Not/A_Zone",
      }),
    ).toThrow(/Invalid IANA timezone/);
  });

  it("resolves America/Chicago standard time (CST)", () => {
    // 2026-01-14 is CST (UTC-6)
    const instant = resolveLocalNotificationInstant({
      localDate: "2026-01-14",
      localTime: "13:00:00",
      timezone: "America/Chicago",
    });
    expect(instant.toISOString()).toBe("2026-01-14T19:00:00.000Z");
  });

  it("resolves America/Chicago daylight time (CDT)", () => {
    const instant = resolveLocalNotificationInstant({
      localDate: "2026-07-14",
      localTime: "13:00:00",
      timezone: "America/Chicago",
    });
    expect(instant.toISOString()).toBe("2026-07-14T18:00:00.000Z");
  });

  it("handles DST spring transition (skip forward)", () => {
    // US spring forward 2026-03-08: 02:00 → 03:00. 02:30 does not exist.
    expect(() =>
      toUtcFromProfileLocal("2026-03-08", "02:30", "America/Chicago"),
    ).toThrow(/daylight-saving/);
  });

  it("handles DST fall transition (ambiguous hour)", () => {
    // US fall back 2026-11-01: 01:30 occurs twice. fromZonedTime selects one
    // valid offset; the local wall-clock is still preserved.
    const instant = resolveLocalNotificationInstant({
      localDate: "2026-11-01",
      localTime: "01:30",
      timezone: "America/Chicago",
    });
    expect(instant.toISOString()).toBe("2026-11-01T06:30:00.000Z");
  });

  it("preserves local wall-clock across DST for morning/evening reviews", () => {
    const morning = resolveLocalNotificationInstant({
      localDate: "2026-07-14",
      localTime: "07:00:00",
      timezone: "America/Chicago",
    });
    const evening = resolveLocalNotificationInstant({
      localDate: "2026-07-14",
      localTime: "20:00:00",
      timezone: "America/Chicago",
    });
    expect(morning.toISOString()).toBe("2026-07-14T12:00:00.000Z");
    expect(evening.toISOString()).toBe("2026-07-15T01:00:00.000Z");
  });

  it("never treats 13:00:00 as 13:00 UTC for Chicago", () => {
    const instant = resolveLocalNotificationInstant({
      localDate: "2026-07-14",
      localTime: "13:00:00",
      timezone: "America/Chicago",
    });
    expect(instant.toISOString()).not.toBe("2026-07-14T13:00:00.000Z");
    expect(instant.toISOString()).toBe("2026-07-14T18:00:00.000Z");
  });
});
