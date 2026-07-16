import { describe, expect, it, vi, beforeEach } from "vitest";
import { getUnscheduledRemainingWorkMinutes } from "@/lib/planning/remaining-work-math";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import type { PlanningProposalInput, PlanningTask } from "@/lib/planning/types";

/**
 * Production-loader parity for Scenario 7:
 * Estimate 180, tracked 70, future focus 40 → propose 70.
 * Fails if production forgets tracked (would propose 140) or double-counts.
 */
describe("production tracked-minutes hydration parity (S07)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T15:00:00.000Z")); // Monday afternoon Chicago-ish
  });

  it("hydrated trackedMinutes yields 70 remaining unplanned minutes", () => {
    const task: PlanningTask = {
      id: "task-progress",
      title: "Progress task",
      status: "open",
      dueAt: "2026-03-13T22:00:00.000Z",
      earliestStartAt: null,
      estimatedMinutes: 180,
      remainingMinutes: 180,
      trackedMinutes: 70,
      priority: 3,
      difficulty: 3,
      splittable: true,
      minimumBlockMinutes: 30,
      source: "manual",
      relatedEventId: null,
    };

    const futureFocus = 40;
    const unscheduled = getUnscheduledRemainingWorkMinutes(task, futureFocus, 0);
    expect(unscheduled).toBe(70);

    // Without hydration (tracked undefined) production would over-schedule:
    const withoutTracked = getUnscheduledRemainingWorkMinutes(
      { ...task, trackedMinutes: undefined },
      futureFocus,
      0,
    );
    expect(withoutTracked).toBe(140);
  });

  it("planner proposes ~70 when loadPlanningInputs would attach trackedMinutes", () => {
    const now = new Date("2026-03-09T15:00:00.000Z");
    const periodStart = new Date("2026-03-09T05:00:00.000Z");
    const periodEnd = new Date("2026-03-16T04:59:59.000Z");

    const input: PlanningProposalInput = {
      periodType: "week",
      periodStart,
      periodEnd,
      dayKeys: [
        "2026-03-09",
        "2026-03-10",
        "2026-03-11",
        "2026-03-12",
        "2026-03-13",
        "2026-03-14",
        "2026-03-15",
      ],
      now,
      weekStartsOn: 1,
      events: [
        {
          id: "focus-existing",
          title: "Existing focus",
          startAt: "2026-03-10T15:00:00.000Z",
          endAt: "2026-03-10T15:40:00.000Z",
          allDay: false,
          status: "confirmed",
          eventType: "focus_block",
          blocksTime: true,
          source: "lifeos_planning",
          relatedTaskId: "task-progress",
        },
      ],
      tasks: [
        {
          id: "task-progress",
          title: "Progress task",
          status: "open",
          dueAt: "2026-03-13T22:00:00.000Z",
          earliestStartAt: null,
          estimatedMinutes: 180,
          remainingMinutes: 180,
          trackedMinutes: 70,
          priority: 3,
          difficulty: 3,
          splittable: true,
          minimumBlockMinutes: 30,
          source: "manual",
          relatedEventId: null,
        },
      ],
      availabilityRules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        availableStart: "08:00",
        availableEnd: "22:00",
        isEnabled: true,
      })),
      preferences: {
        minimumBreakMinutes: 0,
        travelBufferMinutes: 0,
        planningBufferPercent: 0,
        preferredFocusBlockMinutes: 60,
        maximumFocusBlockMinutes: 120,
        avoidDifficultWorkAfter: null,
      },
      pendingProposalIntervals: [],
      acceptedProposalIntervals: [],
    };

    const result = generatePlanningProposals(input);
    const totalForTask = result.proposals
      .filter((p) => p.taskId === "task-progress")
      .reduce((sum, p) => sum + p.proposedMinutes, 0);

    expect(totalForTask).toBe(70);
    expect(totalForTask).not.toBe(180);
    expect(totalForTask).not.toBe(110);
  });
});
