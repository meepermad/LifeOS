import { describe, expect, it } from "vitest";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import { evaluatePlannerInvariants } from "@/lib/planning/invariants";
import { buildPlanningInput, chicago } from "../benchmarks/build-input";
import type { PlannerScenario } from "../benchmarks/types";

function minimalScenario(
  overrides: Partial<PlannerScenario> = {},
): PlannerScenario {
  const mon = "2026-08-24";
  return {
    id: "invariant-fixture",
    name: "Invariant fixture",
    now: chicago(mon, "09:00:00"),
    timezone: "America/Chicago",
    rangeStart: new Date(chicago(mon, "00:00:00")).toISOString(),
    rangeEnd: new Date(chicago(mon, "23:59:59")).toISOString(),
    dayKeys: [mon],
    periodType: "day",
    weekStartsOn: 1,
    preferences: {},
    availabilityRules: [
      {
        dayOfWeek: 1,
        availableStart: "09:00:00",
        availableEnd: "17:00:00",
        isEnabled: true,
      },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Sample",
        estimatedMinutes: 60,
        remainingMinutes: 60,
        dueAt: chicago(mon, "17:00:00"),
      },
    ],
    fixedEvents: [],
    expected: {},
    ...overrides,
  };
}

describe("evaluatePlannerInvariants", () => {
  it("passes for a feasible single-block plan", () => {
    const scenario = minimalScenario();
    const inputs = buildPlanningInput(scenario);
    const result = generatePlanningProposals(inputs);
    const report = evaluatePlannerInvariants({ inputs, result });

    expect(report.criticalFailures).toEqual([]);
    expect(report.passRate).toBeGreaterThan(0.9);
  });

  it("reports critical failure when proposals overlap blocking events", () => {
    const mon = "2026-08-24";
    const scenario = minimalScenario({
      fixedEvents: [
        {
          id: "blocker",
          startAt: chicago(mon, "10:00:00"),
          endAt: chicago(mon, "11:00:00"),
          eventType: "class",
          blocksTime: true,
        },
      ],
      tasks: [
        {
          id: "task-1",
          estimatedMinutes: 60,
          remainingMinutes: 60,
          dueAt: chicago(mon, "17:00:00"),
          splittable: false,
          minimumBlockMinutes: 60,
        },
      ],
    });

    const inputs = buildPlanningInput(scenario);
    const result = generatePlanningProposals(inputs);
    const report = evaluatePlannerInvariants({ inputs, result });

    expect(report.assertions.some((a) => a.id.startsWith("no-block-overlap"))).toBe(
      true,
    );
  });

  it("preserves accepted proposal intervals", () => {
    const mon = "2026-08-24";
    const scenario = minimalScenario({
      existingPlanningBlocks: [
        {
          taskId: "task-1",
          startAt: chicago(mon, "14:00:00"),
          endAt: chicago(mon, "15:00:00"),
          accepted: true,
        },
      ],
      tasks: [
        {
          id: "task-1",
          estimatedMinutes: 120,
          remainingMinutes: 120,
          dueAt: chicago(mon, "17:00:00"),
        },
      ],
    });

    const inputs = buildPlanningInput(scenario);
    const result = generatePlanningProposals(inputs);
    const report = evaluatePlannerInvariants({ inputs, result });
    const preserve = report.assertions.find((a) => a.id === "preserve-accepted-blocks");

    expect(preserve?.passed).toBe(true);
  });
});
