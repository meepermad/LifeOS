import { describe, expect, it } from "vitest";
import {
  deriveCapacityStatus,
  formatMinutes,
  workloadStatusSentence,
} from "@/lib/planning/summaries";

describe("summaries", () => {
  it("formats minutes without excessive precision", () => {
    expect(formatMinutes(135)).toBe("2h 15m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(45)).toBe("45m");
  });

  it("derives manageable status below 0.65 ratio", () => {
    expect(
      deriveCapacityStatus({
        availableFocusMinutes: 100,
        allocatedTaskMinutes: 50,
        requiredTaskMinutes: 50,
        unallocatedTaskMinutes: 0,
        hasIncompleteData: false,
      }),
    ).toBe("manageable");
  });

  it("derives heavy status between thresholds", () => {
    expect(
      deriveCapacityStatus({
        availableFocusMinutes: 100,
        allocatedTaskMinutes: 75,
        requiredTaskMinutes: 75,
        unallocatedTaskMinutes: 0,
        hasIncompleteData: false,
      }),
    ).toBe("heavy");
  });

  it("includes incomplete-data warning in status sentence", () => {
    expect(workloadStatusSentence("incomplete_data", "Today")).toContain(
      "estimates",
    );
  });
});
