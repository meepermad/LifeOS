import { describe, expect, it } from "vitest";
import {
  buildEstimationSamples,
  median,
  summarizeEstimationAccuracy,
} from "@/lib/analytics/metrics";

describe("analytics metrics", () => {
  it("computes median ratio", () => {
    expect(median([1, 2, 9])).toBe(2);
  });

  it("excludes missing estimates", () => {
    const { samples, excluded } = buildEstimationSamples({
      snapshots: [
        {
          task_id: "1",
          original_estimate_minutes: null,
          final_actual_seconds: 3600,
          completed_at: "2026-07-10T00:00:00.000Z",
        },
        {
          task_id: "2",
          original_estimate_minutes: 60,
          final_actual_seconds: 7200,
          completed_at: "2026-07-10T00:00:00.000Z",
        },
      ],
      trackingEpoch: "2026-01-01T00:00:00.000Z",
    });
    expect(samples).toHaveLength(1);
    expect(excluded).toBe(1);
  });

  it("returns insufficient confidence for tiny samples", () => {
    const summary = summarizeEstimationAccuracy([]);
    expect(summary.confidence).toBe("insufficient");
    expect(summary.value).toBeNull();
  });

  it("does not emit productivity score fields", () => {
    const summary = summarizeEstimationAccuracy([
      {
        taskId: "1",
        estimatedMinutes: 60,
        actualMinutes: 90,
        ratio: 1.5,
      },
    ]);
    expect(summary.description).not.toMatch(/productivity/i);
    expect(summary.description).not.toMatch(/score/i);
  });
});
