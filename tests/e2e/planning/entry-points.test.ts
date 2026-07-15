import { describe, expect, it } from "vitest";
import { workloadPeriodSchema } from "@/lib/planning/schemas";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import { evaluatePlannerInvariants } from "@/lib/planning/invariants";

/**
 * Thin e2e-style documentation tests for planning entry points.
 * These verify exported modules and schemas without a live browser session.
 */
describe("planning e2e entry points (documented)", () => {
  it("exports generatePlanningProposals from proposal-generator", () => {
    expect(typeof generatePlanningProposals).toBe("function");
  });

  it("exports evaluatePlannerInvariants from invariants", () => {
    expect(typeof evaluatePlannerInvariants).toBe("function");
  });

  it("workloadPeriodSchema accepts both period types", () => {
    for (const periodType of ["day", "week"] as const) {
      const parsed = workloadPeriodSchema.safeParse({
        periodType,
        periodStart: "2026-08-24T05:00:00.000Z",
        periodEnd: "2026-08-25T04:59:59.000Z",
      });
      expect(parsed.success, periodType).toBe(true);
    }
  });
});
