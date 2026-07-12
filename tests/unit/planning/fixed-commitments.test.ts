import { describe, expect, it } from "vitest";
import {
  buildBlockingIntervalsForDay,
  computeDayCapacity,
} from "@/lib/planning/fixed-commitments";
import { buildAvailabilityIntervalsForDay } from "@/lib/planning/availability";
import { getDayBoundsInUtc } from "@/lib/dates/timezone";
import {
  defaultPlanningPreferences,
  mondayAvailabilityRules,
  planningEvent,
} from "./helpers";

const preferences = defaultPlanningPreferences;

const mondayRules = mondayAvailabilityRules;

function event(partial: Partial<import("@/lib/planning/types").PlanningEvent>) {
  return planningEvent(partial);
}

describe("fixed commitments", () => {
  const dateKey = "2026-07-13";
  const bounds = getDayBoundsInUtc(dateKey);
  const availability = buildAvailabilityIntervalsForDay(dateKey, mondayRules);

  it("ignores cancelled events", () => {
    const capacity = computeDayCapacity({
      dateKey,
      dayStart: bounds.start,
      dayEnd: bounds.end,
      events: [event({ status: "cancelled" })],
      availabilityIntervals: availability,
      preferences,
      hasAvailabilityRules: true,
    });

    expect(capacity.fixedMinutes).toBe(0);
  });

  it("does not block tentative events", () => {
    const capacity = computeDayCapacity({
      dateKey,
      dayStart: bounds.start,
      dayEnd: bounds.end,
      events: [event({ status: "tentative" })],
      availabilityIntervals: availability,
      preferences,
      hasAvailabilityRules: true,
    });

    expect(capacity.fixedMinutes).toBe(0);
  });

  it("does not block deadline events", () => {
    const capacity = computeDayCapacity({
      dateKey,
      dayStart: bounds.start,
      dayEnd: bounds.end,
      events: [event({ eventType: "deadline", blocksTime: false })],
      availabilityIntervals: availability,
      preferences,
      hasAvailabilityRules: true,
    });

    expect(capacity.fixedMinutes).toBe(0);
  });

  it("does not double-count overlapping events", () => {
    const { blocking } = buildBlockingIntervalsForDay(
      [
        event({
          id: "a",
          startAt: "2026-07-13T15:00:00.000Z",
          endAt: "2026-07-13T17:00:00.000Z",
        }),
        event({
          id: "b",
          startAt: "2026-07-13T16:00:00.000Z",
          endAt: "2026-07-13T18:00:00.000Z",
        }),
      ],
      dateKey,
      availability,
      preferences,
    );

    expect(blocking.length).toBeGreaterThan(0);
  });

  it("reserves planning buffer from raw open minutes", () => {
    const capacity = computeDayCapacity({
      dateKey,
      dayStart: bounds.start,
      dayEnd: bounds.end,
      events: [],
      availabilityIntervals: availability,
      preferences,
      hasAvailabilityRules: true,
    });

    expect(capacity.rawOpenMinutes).toBe(8 * 60);
    expect(capacity.reservedBufferMinutes).toBe(Math.floor((8 * 60 * 20) / 100));
    expect(capacity.availableFocusMinutes).toBe(
      capacity.rawOpenMinutes - capacity.reservedBufferMinutes,
    );
  });

  it("returns zero capacity when availability is not configured", () => {
    const capacity = computeDayCapacity({
      dateKey: "2026-07-12",
      dayStart: getDayBoundsInUtc("2026-07-12").start,
      dayEnd: getDayBoundsInUtc("2026-07-12").end,
      events: [],
      availabilityIntervals: [],
      preferences,
      hasAvailabilityRules: false,
    });

    expect(capacity.availableFocusMinutes).toBe(0);
    expect(capacity.needsAvailabilityConfiguration).toBe(true);
  });
});
