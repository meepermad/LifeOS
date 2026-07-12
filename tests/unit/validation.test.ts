import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/constants";
import {
  getAppLocalDateKey,
  toUtcFromAppLocal,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import { parseEventForm } from "@/lib/validation/events";
import { availabilityFormSchema } from "@/lib/validation/availability";
import { planningPreferencesSchema } from "@/lib/validation/preferences";
import {
  applyTaskCompletion,
  parseTaskForm,
} from "@/lib/validation/tasks";

describe("normalizeEmail", () => {
  it("trims and lowercases email addresses", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});

describe("America/Chicago date conversion", () => {
  it("converts a local Central Time datetime to UTC", () => {
    const utc = toUtcFromAppLocal("2026-07-11", "16:30");
    expect(utc.toISOString()).toBe("2026-07-11T21:30:00.000Z");
  });

  it("groups UTC timestamps by Central date", () => {
    const key = getAppLocalDateKey("2026-07-11T04:30:00.000Z");
    expect(key).toBe("2026-07-10");
  });

  it("creates all-day boundaries in Central Time", () => {
    const start = toUtcFromAppLocalDate("2026-07-11");
    expect(start.toISOString()).toBe("2026-07-11T05:00:00.000Z");
  });
});

describe("event validation", () => {
  const calendarId = "00000000-0000-4000-8000-000000000001";

  it("requires a non-empty title", () => {
    expect(() =>
      parseEventForm({
        title: "   ",
        calendarId,
        eventType: "other",
        status: "confirmed",
        allDay: false,
        date: "2026-07-11",
        startTime: "09:00",
        endTime: "10:00",
      }),
    ).toThrow();
  });

  it("requires end after start", () => {
    expect(() =>
      parseEventForm({
        title: "Study",
        calendarId,
        eventType: "focus_block",
        status: "confirmed",
        allDay: false,
        date: "2026-07-11",
        startTime: "12:00",
        endTime: "11:00",
      }),
    ).toThrow();
  });

  it("parses a valid timed event", () => {
    const parsed = parseEventForm({
      title: "Study",
      calendarId,
      eventType: "focus_block",
      status: "confirmed",
      allDay: false,
      date: "2026-07-11",
      startTime: "09:00",
      endTime: "10:30",
    });

    expect(parsed.title).toBe("Study");
    expect(new Date(parsed.endAt).getTime()).toBeGreaterThan(
      new Date(parsed.startAt).getTime(),
    );
  });
});

describe("task validation", () => {
  it("rejects negative estimated minutes", () => {
    expect(() =>
      parseTaskForm({
        title: "Read",
        priority: 3,
        difficulty: 3,
        status: "open",
        splittable: true,
        minimumBlockMinutes: 25,
        estimatedMinutes: -5,
      }),
    ).toThrow();
  });

  it("defaults remaining minutes to estimated minutes", () => {
    const parsed = parseTaskForm({
      title: "Read",
      priority: 3,
      difficulty: 3,
      status: "open",
      splittable: true,
      minimumBlockMinutes: 25,
      estimatedMinutes: 60,
    });

    expect(parsed.remainingMinutes).toBe(60);
  });

  it("completes and reopens tasks with sensible remaining time", () => {
    const completed = applyTaskCompletion(
      { estimated_minutes: 90, remaining_minutes: 45 },
      true,
    );
    expect(completed.status).toBe("completed");
    expect(completed.remaining_minutes).toBe(0);
    expect(completed.completed_at).not.toBeNull();

    const reopened = applyTaskCompletion(
      { estimated_minutes: 90, remaining_minutes: 0 },
      false,
    );
    expect(reopened.status).toBe("open");
    expect(reopened.remaining_minutes).toBe(90);
    expect(reopened.completed_at).toBeNull();
  });
});

describe("availability validation", () => {
  it("enforces day bounds and end after start", () => {
    expect(() =>
      availabilityFormSchema.parse({
        dayOfWeek: 7,
        availableStart: "09:00",
        availableEnd: "17:00",
        isEnabled: true,
      }),
    ).toThrow();

    expect(() =>
      availabilityFormSchema.parse({
        dayOfWeek: 1,
        availableStart: "18:00",
        availableEnd: "09:00",
        isEnabled: true,
      }),
    ).toThrow();
  });
});

describe("planning preference validation", () => {
  it("requires maximum focus block to be at least preferred", () => {
    expect(() =>
      planningPreferencesSchema.parse({
        minimumBreakMinutes: 15,
        travelBufferMinutes: 15,
        planningBufferPercent: 20,
        preferredFocusBlockMinutes: 90,
        maximumFocusBlockMinutes: 60,
        weeklyNotificationDay: 0,
        autoCreateFocusBlocks: false,
      }),
    ).toThrow();
  });
});
