import { describe, expect, it } from "vitest";
import { calculateWorkload } from "@/lib/planning/workload";
import type { WorkloadInputs } from "@/lib/planning/types";
import { defaultPlanningPreferences } from "./planning/helpers";

const dayKey = "2026-07-15";

const baseInputs: WorkloadInputs = {
  events: [],
  tasks: [],
  availabilityRules: [
    {
      dayOfWeek: 3,
      availableStart: "08:00:00",
      availableEnd: "22:00:00",
      isEnabled: true,
    },
  ],
  preferences: defaultPlanningPreferences,
  weekStartsOn: 0,
  now: new Date(`${dayKey}T12:00:00.000Z`),
  periodType: "day",
  periodStart: new Date(`${dayKey}T05:00:00.000Z`),
  periodEnd: new Date("2026-07-16T04:59:59.000Z"),
  dayKeys: [dayKey],
};

describe("microsoft integration regression", () => {
  it("includes blocking Microsoft events in workload calculations", () => {
    const summary = calculateWorkload({
      ...baseInputs,
      events: [
        {
          id: "ms-event-1",
          title: "Outlook meeting",
          startAt: `${dayKey}T14:00:00.000Z`,
          endAt: `${dayKey}T15:00:00.000Z`,
          allDay: false,
          status: "confirmed",
          eventType: "meeting",
          blocksTime: true,
          source: "microsoft",
          relatedTaskId: null,
        },
      ],
    });

    expect(summary.fixedMinutes).toBeGreaterThan(0);
  });

  it("does not count free Microsoft all-day events as blockers", () => {
    const summary = calculateWorkload({
      ...baseInputs,
      events: [
        {
          id: "ms-event-2",
          title: "Free all day",
          startAt: `${dayKey}T05:00:00.000Z`,
          endAt: "2026-07-16T05:00:00.000Z",
          allDay: true,
          status: "confirmed",
          eventType: "other",
          blocksTime: false,
          source: "microsoft",
          relatedTaskId: null,
        },
      ],
    });

    expect(summary.fixedMinutes).toBe(0);
  });
});
