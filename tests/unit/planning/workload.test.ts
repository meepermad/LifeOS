import { describe, expect, it } from "vitest";
import { calculateWorkload } from "@/lib/planning/workload";
import type { WorkloadInputs } from "@/lib/planning/types";

import { defaultPlanningPreferences } from "./helpers";

const baseInputs: WorkloadInputs = {
  events: [],
  tasks: [],
  availabilityRules: [
    {
      dayOfWeek: 1,
      availableStart: "09:00:00",
      availableEnd: "17:00:00",
      isEnabled: true,
    },
  ],
  preferences: defaultPlanningPreferences,
  weekStartsOn: 0,
  now: new Date("2026-07-13T12:00:00.000Z"),
  periodType: "day",
  periodStart: new Date("2026-07-13T05:00:00.000Z"),
  periodEnd: new Date("2026-07-14T04:59:59.000Z"),
  dayKeys: ["2026-07-13"],
};

describe("workload", () => {
  it("reports clear when no estimated work exists", () => {
    const summary = calculateWorkload(baseInputs);
    expect(summary.status).toBe("clear");
  });

  it("reports no_capacity when work exists but focus time is zero", () => {
    const summary = calculateWorkload({
      ...baseInputs,
      availabilityRules: [],
      tasks: [
        {
          id: "task-1",
          title: "Work",
          status: "open",
          dueAt: "2026-07-13T23:59:00.000Z",
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
    });

    expect(summary.availableFocusMinutes).toBe(0);
    expect(summary.status).toBe("no_capacity");
  });

  it("flags incomplete data when tasks lack estimates", () => {
    const summary = calculateWorkload({
      ...baseInputs,
      tasks: [
        {
          id: "task-1",
          title: "Unknown",
          status: "open",
          dueAt: "2026-07-13T23:59:00.000Z",
          earliestStartAt: null,
          estimatedMinutes: null,
          remainingMinutes: null,
          priority: 3,
          difficulty: 3,
          splittable: true,
          minimumBlockMinutes: 25,
          source: "manual",
          relatedEventId: null,
        },
      ],
    });

    expect(summary.hasIncompleteData).toBe(true);
    expect(summary.unestimatedTaskCount).toBe(1);
  });

  it("flags incomplete data for unestimated canvas tasks", () => {
    const summary = calculateWorkload({
      ...baseInputs,
      tasks: [
        {
          id: "canvas-task-1",
          title: "Canvas assignment",
          status: "open",
          dueAt: "2026-07-13T23:59:00.000Z",
          earliestStartAt: null,
          estimatedMinutes: null,
          remainingMinutes: null,
          priority: 3,
          difficulty: 3,
          splittable: true,
          minimumBlockMinutes: 25,
          source: "canvas",
          relatedEventId: "event-1",
        },
      ],
    });

    expect(summary.hasIncompleteData).toBe(true);
    expect(summary.unestimatedTaskCount).toBe(1);
  });

  it("includes estimated canvas tasks in workload", () => {
    const summary = calculateWorkload({
      ...baseInputs,
      tasks: [
        {
          id: "canvas-task-1",
          title: "Canvas assignment",
          status: "open",
          dueAt: "2026-07-13T23:59:00.000Z",
          earliestStartAt: null,
          estimatedMinutes: 90,
          remainingMinutes: 90,
          priority: 3,
          difficulty: 3,
          splittable: true,
          minimumBlockMinutes: 25,
          source: "canvas",
          relatedEventId: "event-1",
        },
      ],
    });

    expect(summary.requiredTaskMinutes).toBe(90);
    expect(summary.unestimatedTaskCount).toBe(0);
  });

  it("excludes completed and cancelled canvas tasks", () => {
    const summary = calculateWorkload({
      ...baseInputs,
      tasks: [
        {
          id: "completed",
          title: "Done",
          status: "completed",
          dueAt: "2026-07-13T23:59:00.000Z",
          earliestStartAt: null,
          estimatedMinutes: 90,
          remainingMinutes: 0,
          priority: 3,
          difficulty: 3,
          splittable: true,
          minimumBlockMinutes: 25,
          source: "canvas",
          relatedEventId: "event-1",
        },
        {
          id: "cancelled",
          title: "Cancelled",
          status: "cancelled",
          dueAt: "2026-07-13T23:59:00.000Z",
          earliestStartAt: null,
          estimatedMinutes: 90,
          remainingMinutes: 90,
          priority: 3,
          difficulty: 3,
          splittable: true,
          minimumBlockMinutes: 25,
          source: "canvas",
          relatedEventId: "event-2",
        },
      ],
    });

    expect(summary.requiredTaskMinutes).toBe(0);
  });
});
