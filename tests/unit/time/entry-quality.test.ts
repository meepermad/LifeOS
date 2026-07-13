import { describe, expect, it } from "vitest";
import { checkEntryQuality, isImplausibleDuration } from "@/lib/time/entry-quality";

describe("entry-quality", () => {
  it("flags excessive duration", () => {
    const result = checkEntryQuality({
      started_at: "2026-07-01T08:00:00.000Z",
      ended_at: "2026-07-02T08:00:00.000Z",
      duration_seconds: 13 * 60 * 60,
      entry_source: "manual",
    });
    expect(result.needsReview).toBe(true);
    expect(result.reasons).toContain("excessive_duration");
  });

  it("detects implausible durations for review UI", () => {
    expect(isImplausibleDuration(30)).toBe(true);
    expect(isImplausibleDuration(3600)).toBe(false);
  });
});
