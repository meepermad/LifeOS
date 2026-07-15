import { describe, expect, it } from "vitest";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import { toPlanningTask } from "@/lib/planning/mappers";
import { workloadPeriodSchema } from "@/lib/planning/schemas";
import type { TaskRow } from "@/types/domain";
import { buildPlanningInput, chicago } from "../../unit/planning/benchmarks/build-input";
import type { PlannerScenario } from "../../unit/planning/benchmarks/types";

describe("planning integration entry points", () => {
  it("generatePlanningProposals accepts benchmark-built input", () => {
    const mon = "2026-08-24";
    const scenario: PlannerScenario = {
      id: "integration-smoke",
      name: "Integration smoke",
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
          availableEnd: "17:00:00",
          isEnabled: true,
        },
      ],
      tasks: [
        {
          id: "integration-task",
          estimatedMinutes: 45,
          remainingMinutes: 45,
          dueAt: chicago(mon, "17:00:00"),
        },
      ],
      fixedEvents: [],
      expected: {},
    };

    const input = buildPlanningInput(scenario);
    const result = generatePlanningProposals(input);

    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.totalProposedMinutes).toBe(45);
  });

  it("toPlanningTask maps domain rows into planner task shape", () => {
    const mon = "2026-08-24";
    const mapped = toPlanningTask({
      id: "t1",
      title: "Mapped task",
      status: "open",
      due_at: chicago(mon, "17:00:00"),
      estimated_minutes: 30,
      remaining_minutes: 30,
      priority: 3,
      difficulty: 3,
      splittable: true,
      minimum_block_minutes: 25,
      source: "manual",
      related_event_id: null,
    } as unknown as TaskRow);

    expect(mapped.title).toBe("Mapped task");
    expect(mapped.estimatedMinutes).toBe(30);
  });

  it("workloadPeriodSchema accepts day and week period types", () => {
    const mon = "2026-08-24";
    const day = workloadPeriodSchema.safeParse({
      periodType: "day",
      periodStart: chicago(mon, "00:00:00"),
      periodEnd: chicago(mon, "23:59:59"),
    });
    const week = workloadPeriodSchema.safeParse({
      periodType: "week",
      periodStart: chicago(mon, "00:00:00"),
      periodEnd: chicago("2026-08-30", "23:59:59"),
    });

    expect(day.success).toBe(true);
    expect(week.success).toBe(true);
  });
});
