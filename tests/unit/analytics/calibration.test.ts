import { describe, expect, it } from "vitest";
import {
  computeAppliedFactor,
  getEffectiveEstimateMinutes,
  resolveCalibration,
} from "@/lib/analytics/calibration";
import type { CalibrationSample } from "@/lib/analytics/calibration";

describe("calibration", () => {
  it("does not apply factor below minimum samples", () => {
    expect(computeAppliedFactor(1.5, 4)).toBe(1);
  });

  it("blends conservatively at minimum samples", () => {
    const factor = computeAppliedFactor(1.5, 5);
    expect(factor).toBeCloseTo(1.2, 1);
  });

  it("clamps factor within bounds", () => {
    expect(computeAppliedFactor(3, 20)).toBeLessThanOrEqual(1.75);
    expect(computeAppliedFactor(0.2, 20)).toBeGreaterThanOrEqual(0.75);
  });

  it("uses original estimate when adaptive disabled", () => {
    const calibration = resolveCalibration(new Map(), [], 60);
    const result = getEffectiveEstimateMinutes({
      userEstimate: 60,
      calibration,
      adaptiveEnabled: false,
      override: null,
    });
    expect(result.effective).toBe(60);
    expect(result.factor).toBe(1);
  });

  it("picks most specific group with enough samples", () => {
    const samples = new Map<string, CalibrationSample[]>([
      [
        "course:net|category:canvas",
        Array.from({ length: 5 }, (_, i) => ({
          taskId: `t-${i}`,
          ratio: 1.2,
          completedAt: "2026-07-01T00:00:00.000Z",
        })),
      ],
    ]);

    const result = resolveCalibration(samples, [
      { level: "course_category", key: "course:net|category:canvas" },
      { level: "category", key: "category:canvas" },
    ], 60);

    expect(result.sampleCount).toBe(5);
    expect(result.appliedFactor).toBeGreaterThan(1);
  });

  it("exact factors at n=4,5,10,25 for rawMedian 1.5", () => {
    expect(computeAppliedFactor(1.5, 4)).toBe(1);
    expect(computeAppliedFactor(1.5, 5)).toBeCloseTo(1.2, 2);
    expect(computeAppliedFactor(1.5, 10)).toBeCloseTo(1.286, 2);
    expect(computeAppliedFactor(1.5, 25)).toBeCloseTo(1.385, 2);
  });
});
