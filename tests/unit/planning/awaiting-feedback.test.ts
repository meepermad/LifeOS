import { describe, expect, it } from "vitest";
import { isAwaitingFeedbackEligible } from "@/lib/planning/awaiting-feedback";

describe("awaiting feedback eligibility", () => {
  const now = new Date("2026-07-14T18:00:00.000Z");

  it("accepts confirmed focus blocks that have ended", () => {
    expect(
      isAwaitingFeedbackEligible(
        {
          event_type: "focus_block",
          status: "confirmed",
          end_at: "2026-07-14T17:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("rejects cancelled blocks", () => {
    expect(
      isAwaitingFeedbackEligible(
        {
          event_type: "focus_block",
          status: "cancelled",
          end_at: "2026-07-14T17:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects blocks that have not ended yet", () => {
    expect(
      isAwaitingFeedbackEligible(
        {
          event_type: "focus_block",
          status: "confirmed",
          end_at: "2026-07-14T19:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects non-focus events", () => {
    expect(
      isAwaitingFeedbackEligible(
        {
          event_type: "meeting",
          status: "confirmed",
          end_at: "2026-07-14T17:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });
});
