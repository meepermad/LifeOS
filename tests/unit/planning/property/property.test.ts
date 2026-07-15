import { describe, expect, it } from "vitest";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import { proposalsAreDeterministic } from "@/lib/planning/invariants";
import { buildPlanningInput, chicago } from "../benchmarks/build-input";
import type { PlannerScenario } from "../benchmarks/types";

const FUZZ_SEED = 42;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function fuzzScenario(seed: number, index: number): PlannerScenario {
  const rand = seededRandom(seed + index * 997);
  const mon = "2026-08-24";
  const taskCount = 1 + Math.floor(rand() * 3);
  const tasks = Array.from({ length: taskCount }, (_, i) => ({
    id: `fuzz-task-${index}-${i}`,
    estimatedMinutes: 30 + Math.floor(rand() * 4) * 15,
    remainingMinutes: 30 + Math.floor(rand() * 4) * 15,
    dueAt: chicago(mon, `${16 + i}:00:00`),
    priority: 1 + Math.floor(rand() * 5),
    splittable: rand() > 0.3,
  }));

  return {
    id: `fuzz-${index}`,
    name: `Fuzz scenario ${index}`,
    now: chicago(mon, "09:00:00"),
    timezone: "America/Chicago",
    rangeStart: new Date(chicago(mon, "00:00:00")).toISOString(),
    rangeEnd: new Date(chicago(mon, "23:59:59")).toISOString(),
    dayKeys: [mon],
    periodType: "day",
    weekStartsOn: 1,
    preferences: {
      minimumBreakMinutes: rand() > 0.5 ? 15 : 0,
      planningBufferPercent: 0,
      travelBufferMinutes: 0,
    },
    availabilityRules: [
      {
        dayOfWeek: 1,
        availableStart: "09:00:00",
        availableEnd: "17:00:00",
        isEnabled: true,
      },
    ],
    tasks,
    fixedEvents: [],
    expected: {},
  };
}

describe("planner property tests", () => {
  it("seeded fuzz — no negative unscheduled minutes (seed 42)", () => {
    const rand = seededRandom(FUZZ_SEED);
    void rand;

    for (let i = 0; i < 20; i += 1) {
      const scenario = fuzzScenario(FUZZ_SEED, i);
      const inputs = buildPlanningInput(scenario);
      const result = generatePlanningProposals(inputs);

      expect(result.unscheduledMinutes).toBeGreaterThanOrEqual(0);
      for (const proposal of result.proposals) {
        expect(proposal.proposedMinutes).toBeGreaterThan(0);
        expect(new Date(proposal.proposedEndAt).getTime()).toBeGreaterThan(
          new Date(proposal.proposedStartAt).getTime(),
        );
      }
    }
  });

  it("metamorphic — adding availability never reduces proposed minutes", () => {
    const mon = "2026-08-24";
    const base: PlannerScenario = {
      id: "meta-base",
      name: "Metamorphic base",
      now: chicago(mon, "09:00:00"),
      timezone: "America/Chicago",
      rangeStart: new Date(chicago(mon, "00:00:00")).toISOString(),
      rangeEnd: new Date(chicago(mon, "23:59:59")).toISOString(),
      dayKeys: [mon],
      periodType: "day",
      weekStartsOn: 1,
      preferences: { planningBufferPercent: 0, travelBufferMinutes: 0 },
      availabilityRules: [
        {
          dayOfWeek: 1,
          availableStart: "09:00:00",
          availableEnd: "12:00:00",
          isEnabled: true,
        },
      ],
      tasks: [
        {
          id: "meta-task",
          estimatedMinutes: 120,
          remainingMinutes: 120,
          dueAt: chicago(mon, "17:00:00"),
        },
      ],
      fixedEvents: [],
      expected: {},
    };

    const expanded: PlannerScenario = {
      ...base,
      availabilityRules: [
        {
          dayOfWeek: 1,
          availableStart: "09:00:00",
          availableEnd: "17:00:00",
          isEnabled: true,
        },
      ],
    };

    const baseResult = generatePlanningProposals(buildPlanningInput(base));
    const expandedResult = generatePlanningProposals(buildPlanningInput(expanded));

    expect(expandedResult.totalProposedMinutes).toBeGreaterThanOrEqual(
      baseResult.totalProposedMinutes,
    );
  });

  it("metamorphic — planner output is deterministic for identical input", () => {
    const scenario = fuzzScenario(FUZZ_SEED, 999);
    const inputs = buildPlanningInput(scenario);
    const first = generatePlanningProposals(inputs);
    const second = generatePlanningProposals(inputs);

    expect(proposalsAreDeterministic(first.proposals, second.proposals)).toBe(
      true,
    );
  });
});
