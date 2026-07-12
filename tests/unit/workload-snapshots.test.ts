import { describe, expect, it } from "vitest";
import { computeWorkloadInputHash } from "@/lib/planning/input-hash";
import type { WorkloadInputs } from "@/lib/planning/types";

import { defaultPlanningPreferences } from "./planning/helpers";

const baseInputs: WorkloadInputs = {
  events: [],
  tasks: [],
  availabilityRules: [],
  preferences: defaultPlanningPreferences,
  weekStartsOn: 0,
  now: new Date("2026-07-13T12:00:00.000Z"),
  periodType: "day",
  periodStart: new Date("2026-07-13T05:00:00.000Z"),
  periodEnd: new Date("2026-07-14T04:59:59.000Z"),
  dayKeys: ["2026-07-13"],
};

describe("workload input hash", () => {
  it("remains stable for unchanged inputs", () => {
    const first = computeWorkloadInputHash(baseInputs);
    const second = computeWorkloadInputHash(baseInputs);
    expect(first).toBe(second);
  });

  it("changes when task workload changes", () => {
    const changed: WorkloadInputs = {
      ...baseInputs,
      tasks: [
        {
          id: "task-1",
          title: "Task",
          status: "open",
          dueAt: null,
          earliestStartAt: null,
          estimatedMinutes: 60,
          remainingMinutes: 60,
          priority: 3,
          difficulty: 3,
          splittable: true,
          minimumBlockMinutes: 25,
          source: "manual",
          relatedEventId: null,
        },
      ],
    };

    expect(computeWorkloadInputHash(changed)).not.toBe(
      computeWorkloadInputHash(baseInputs),
    );
  });
});
