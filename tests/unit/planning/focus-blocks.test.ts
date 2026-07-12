import { describe, expect, it } from "vitest";
import {
  chooseBlockSize,
  findSlotInIntervals,
} from "@/lib/planning/focus-blocks";
import { defaultPlanningPreferences } from "./helpers";

describe("focus blocks", () => {
  it("prefers configured block length for splittable tasks", () => {
    const size = chooseBlockSize({
      remainingMinutes: 180,
      splittable: true,
      minimumBlockMinutes: 25,
      preferredFocusBlockMinutes: 60,
      maximumFocusBlockMinutes: 120,
      dayBudgetMinutes: 120,
    });

    expect(size).toBe(60);
  });

  it("does not exceed maximum block length", () => {
    const size = chooseBlockSize({
      remainingMinutes: 180,
      splittable: true,
      minimumBlockMinutes: 25,
      preferredFocusBlockMinutes: 60,
      maximumFocusBlockMinutes: 90,
      dayBudgetMinutes: 120,
    });

    expect(size).toBeLessThanOrEqual(90);
  });

  it("requires full remaining time for non-splittable tasks", () => {
    const size = chooseBlockSize({
      remainingMinutes: 90,
      splittable: false,
      minimumBlockMinutes: 25,
      preferredFocusBlockMinutes: 60,
      maximumFocusBlockMinutes: 120,
      dayBudgetMinutes: 120,
    });

    expect(size).toBe(90);
  });

  it("fails non-splittable placement when interval too small", () => {
    const size = chooseBlockSize({
      remainingMinutes: 90,
      splittable: false,
      minimumBlockMinutes: 25,
      preferredFocusBlockMinutes: 60,
      maximumFocusBlockMinutes: 120,
      dayBudgetMinutes: 60,
    });

    expect(size).toBeNull();
  });

  it("prefers slots ending before difficult-work cutoff", () => {
    const early = findSlotInIntervals({
      intervals: [{ startMs: Date.parse("2026-07-13T14:00:00.000Z"), endMs: Date.parse("2026-07-13T18:00:00.000Z") }],
      durationMinutes: 60,
      preferEndBeforeMs: Date.parse("2026-07-13T17:00:00.000Z"),
    });

    expect(early).not.toBeNull();
    expect(early!.endMs).toBeLessThanOrEqual(
      Date.parse("2026-07-13T17:00:00.000Z"),
    );
  });

  it("respects due date as latest end", () => {
    const slot = findSlotInIntervals({
      intervals: [{ startMs: Date.parse("2026-07-13T14:00:00.000Z"), endMs: Date.parse("2026-07-13T20:00:00.000Z") }],
      durationMinutes: 60,
      latestEndMs: Date.parse("2026-07-13T16:00:00.000Z"),
    });

    expect(slot).not.toBeNull();
    expect(slot!.endMs).toBeLessThanOrEqual(
      Date.parse("2026-07-13T16:00:00.000Z"),
    );
  });

  it("uses minimum block size for splittable tasks", () => {
    const size = chooseBlockSize({
      remainingMinutes: 30,
      splittable: true,
      minimumBlockMinutes: 25,
      preferredFocusBlockMinutes: 60,
      maximumFocusBlockMinutes: 120,
      dayBudgetMinutes: 30,
    });

    expect(size).toBe(30);
  });
});

describe("focus block preferences", () => {
  it("exposes default preference values", () => {
    expect(defaultPlanningPreferences.preferredFocusBlockMinutes).toBe(60);
    expect(defaultPlanningPreferences.maximumFocusBlockMinutes).toBe(120);
  });
});
