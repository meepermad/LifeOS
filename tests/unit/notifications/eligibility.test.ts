import { describe, expect, it } from "vitest";
import {
  evaluateTimedEligibility,
  NOTIFICATION_GRACE_WINDOW_MS,
} from "@/lib/notifications/eligibility";
import { resolveLocalNotificationInstant } from "@/lib/dates/timezone";

describe("evaluateTimedEligibility", () => {
  const timezone = "America/Chicago";
  const scheduled = resolveLocalNotificationInstant({
    localDate: "2026-07-14",
    localTime: "13:00:00",
    timezone,
  });

  it("is not due at 11:08 AM Chicago", () => {
    const now = new Date("2026-07-14T16:08:00.000Z");
    expect(evaluateTimedEligibility(scheduled, now)).toBe("not_due_yet");
  });

  it("is due at exact scheduled time", () => {
    const now = new Date("2026-07-14T18:00:00.000Z");
    expect(evaluateTimedEligibility(scheduled, now)).toBe("due");
  });

  it("is due one cron interval late (1:15 PM)", () => {
    const now = new Date("2026-07-14T18:15:00.000Z");
    expect(evaluateTimedEligibility(scheduled, now)).toBe("due");
  });

  it("is stale after the grace window", () => {
    const now = new Date(
      scheduled.getTime() + NOTIFICATION_GRACE_WINDOW_MS + 60_000,
    );
    expect(evaluateTimedEligibility(scheduled, now)).toBe("stale");
  });

  it("uses the documented 20-minute grace window", () => {
    expect(NOTIFICATION_GRACE_WINDOW_MS).toBe(20 * 60 * 1000);
    const atGraceEdge = new Date(scheduled.getTime() + 20 * 60 * 1000);
    // scheduledInstant > previousEligibleBoundary fails when equal to boundary
    expect(evaluateTimedEligibility(scheduled, atGraceEdge)).toBe("stale");
    const justInside = new Date(scheduled.getTime() + 20 * 60 * 1000 - 1);
    expect(evaluateTimedEligibility(scheduled, justInside)).toBe("due");
  });
});
