import { describe, expect, it } from "vitest";
import { computeOpenIntervalsForDay } from "@/lib/planning/open-intervals";
import { buildAvailabilityIntervalsForDay } from "@/lib/planning/availability";
import { getDayBoundsInUtc } from "@/lib/dates/timezone";
import {
  defaultPlanningPreferences,
  mondayAvailabilityRules,
  planningEvent,
} from "./helpers";

describe("open intervals", () => {
  const dateKey = "2026-07-13";
  const availability = buildAvailabilityIntervalsForDay(
    dateKey,
    mondayAvailabilityRules,
  );

  it("returns open intervals after subtracting blocking events", () => {
    const result = computeOpenIntervalsForDay({
      dateKey,
      events: [
        planningEvent({
          startAt: "2026-07-13T14:00:00.000Z",
          endAt: "2026-07-13T15:00:00.000Z",
        }),
      ],
      availabilityIntervals: availability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    expect(result.openIntervals.length).toBeGreaterThan(0);
    expect(result.availableFocusMinutes).toBeGreaterThan(0);
  });

  it("merges overlapping blocking events without double subtraction", () => {
    const overlapping = computeOpenIntervalsForDay({
      dateKey,
      events: [
        planningEvent({
          id: "a",
          startAt: "2026-07-13T14:00:00.000Z",
          endAt: "2026-07-13T15:00:00.000Z",
        }),
        planningEvent({
          id: "b",
          startAt: "2026-07-13T14:30:00.000Z",
          endAt: "2026-07-13T15:30:00.000Z",
        }),
      ],
      availabilityIntervals: availability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    const separate = computeOpenIntervalsForDay({
      dateKey,
      events: [
        planningEvent({
          id: "a",
          startAt: "2026-07-13T14:00:00.000Z",
          endAt: "2026-07-13T15:00:00.000Z",
        }),
      ],
      availabilityIntervals: availability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    expect(overlapping.availableFocusMinutes).toBeLessThanOrEqual(
      separate.availableFocusMinutes,
    );
  });

  it("applies travel buffer around meetings", () => {
    const withMeeting = computeOpenIntervalsForDay({
      dateKey,
      events: [
        planningEvent({
          eventType: "meeting",
          startAt: "2026-07-13T15:00:00.000Z",
          endAt: "2026-07-13T16:00:00.000Z",
        }),
      ],
      availabilityIntervals: availability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    const without = computeOpenIntervalsForDay({
      dateKey,
      events: [],
      availabilityIntervals: availability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    expect(withMeeting.availableFocusMinutes).toBeLessThan(
      without.availableFocusMinutes,
    );
  });

  it("treats confirmed focus blocks as blocking", () => {
    const withFocus = computeOpenIntervalsForDay({
      dateKey,
      events: [
        planningEvent({
          eventType: "focus_block",
          startAt: "2026-07-13T15:00:00.000Z",
          endAt: "2026-07-13T16:00:00.000Z",
        }),
      ],
      availabilityIntervals: availability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    const without = computeOpenIntervalsForDay({
      dateKey,
      events: [],
      availabilityIntervals: availability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    expect(withFocus.scheduledFocusMinutes).toBe(60);
    expect(withFocus.availableFocusMinutes).toBeLessThan(
      without.availableFocusMinutes,
    );
  });

  it("limits proposal budget with planning buffer", () => {
    const result = computeOpenIntervalsForDay({
      dateKey,
      events: [],
      availabilityIntervals: availability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    expect(result.remainingProposalBudgetMinutes).toBe(
      result.availableFocusMinutes,
    );
    expect(result.availableFocusMinutes).toBeLessThan(8 * 60);
  });

  it("handles DST spring-forward day", () => {
    const springKey = "2026-03-08";
    const sundayRules = [
      {
        dayOfWeek: 0,
        availableStart: "09:00:00",
        availableEnd: "12:00:00",
        isEnabled: true,
      },
    ];
    const springAvailability = buildAvailabilityIntervalsForDay(
      springKey,
      sundayRules,
    );
    const bounds = getDayBoundsInUtc(springKey);

    const result = computeOpenIntervalsForDay({
      dateKey: springKey,
      events: [],
      availabilityIntervals: springAvailability,
      preferences: defaultPlanningPreferences,
      hasAvailabilityRules: true,
    });

    expect(bounds.start).toBeInstanceOf(Date);
    expect(result.openIntervals.length).toBeGreaterThan(0);
  });
});
