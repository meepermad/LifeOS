import { describe, expect, it } from "vitest";
import {
  mapTaskViewToFilter,
  resolveDailyReviewStepIndex,
  resolveWeeklyReviewStepIndex,
} from "@/lib/notifications/deep-links";
import { sanitizeInternalReturnPath } from "@/lib/notifications/destination";

describe("deep-link helpers", () => {
  it("opens morning and evening review steps", () => {
    expect(resolveDailyReviewStepIndex("morning", undefined, 0)).toBe(0);
    expect(resolveDailyReviewStepIndex("morning", "priorities", 0)).toBe(3);
    expect(
      resolveDailyReviewStepIndex("evening", "planning-feedback", 0),
    ).toBe(2);
    expect(resolveDailyReviewStepIndex("evening", "bogus", 1)).toBe(1);
  });

  it("maps weekly capacity to planning step", () => {
    expect(resolveWeeklyReviewStepIndex("capacity", 0)).toBe(8);
    expect(resolveWeeklyReviewStepIndex("timing", 0)).toBe(0);
    expect(resolveWeeklyReviewStepIndex("nope", 3)).toBe(3);
  });

  it("maps task views to filters", () => {
    expect(mapTaskViewToFilter("waiting")).toBe("waiting");
    expect(mapTaskViewToFilter("overdue")).toBe("overdue");
    expect(mapTaskViewToFilter("upcoming")).toBe("due_this_week");
  });

  it("sanitizes logged-out return destinations", () => {
    expect(
      sanitizeInternalReturnPath("/review/daily?period=morning"),
    ).toBe("/review/daily?period=morning");
    expect(sanitizeInternalReturnPath("//evil.example")).toBe("/today");
    expect(sanitizeInternalReturnPath("https://evil.example")).toBe("/today");
  });
});
