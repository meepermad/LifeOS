import { describe, expect, it } from "vitest";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import type { PlanningProposalInput, PlanningTask } from "@/lib/planning/types";
import {
  defaultPlanningPreferences,
  mondayAvailabilityRules,
  planningEvent,
} from "./helpers";

function baseInput(
  partial: Partial<PlanningProposalInput> = {},
): PlanningProposalInput {
  return {
    events: [],
    tasks: [],
    availabilityRules: mondayAvailabilityRules,
    preferences: defaultPlanningPreferences,
    weekStartsOn: 0,
    now: new Date("2026-07-13T12:00:00.000Z"),
    periodType: "day",
    periodStart: new Date("2026-07-13T05:00:00.000Z"),
    periodEnd: new Date("2026-07-14T04:59:59.000Z"),
    dayKeys: ["2026-07-13"],
    pendingProposalIntervals: [],
    acceptedProposalIntervals: [],
    ...partial,
  };
}

function task(partial: Partial<PlanningTask>): PlanningTask {
  return {
    id: partial.id ?? "task-1",
    title: partial.title ?? "Task",
    status: partial.status ?? "open",
    dueAt: partial.dueAt ?? "2026-07-14T04:59:00.000Z",
    earliestStartAt: partial.earliestStartAt ?? null,
    estimatedMinutes:
      "estimatedMinutes" in partial ? partial.estimatedMinutes! : 60,
    remainingMinutes:
      "remainingMinutes" in partial ? partial.remainingMinutes! : 60,
    priority: partial.priority ?? 3,
    difficulty: partial.difficulty ?? 3,
    splittable: partial.splittable ?? true,
    minimumBlockMinutes: partial.minimumBlockMinutes ?? 25,
    source: "manual",
    relatedEventId: null,
  };
}

describe("proposal generator", () => {
  it("schedules higher-priority earlier-deadline tasks first", () => {
    const result = generatePlanningProposals(
      baseInput({
        tasks: [
          task({
            id: "low",
            title: "Low",
            priority: 4,
            dueAt: "2026-07-15T04:59:00.000Z",
            remainingMinutes: 60,
          }),
          task({
            id: "high",
            title: "High",
            priority: 1,
            dueAt: "2026-07-14T04:59:00.000Z",
            remainingMinutes: 60,
          }),
        ],
      }),
    );

    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.proposals[0].taskId).toBe("high");
  });

  it("reduces unscheduled remaining when focus blocks already exist", () => {
    const result = generatePlanningProposals(
      baseInput({
        tasks: [task({ id: "task-1", remainingMinutes: 120 })],
        events: [
          planningEvent({
            id: "focus-1",
            eventType: "focus_block",
            relatedTaskId: "task-1",
            startAt: "2026-07-13T20:00:00.000Z",
            endAt: "2026-07-13T21:00:00.000Z",
          }),
        ],
      }),
    );

    const proposedForTask = result.proposals
      .filter((p) => p.taskId === "task-1")
      .reduce((sum, p) => sum + p.proposedMinutes, 0);

    expect(proposedForTask).toBeLessThanOrEqual(60);
  });

  it("marks non-splittable tasks unschedulable when no single slot fits", () => {
    const result = generatePlanningProposals(
      baseInput({
        tasks: [
          task({
            id: "big",
            splittable: false,
            remainingMinutes: 500,
          }),
        ],
      }),
    );

    expect(result.proposals.length).toBe(0);
    expect(result.unschedulableTasks.length).toBe(1);
    expect(result.unschedulableTasks[0].taskId).toBe("big");
  });

  it("does not propose work after due date", () => {
    const result = generatePlanningProposals(
      baseInput({
        tasks: [
          task({
            dueAt: "2026-07-13T15:00:00.000Z",
            remainingMinutes: 60,
          }),
        ],
      }),
    );

    for (const proposal of result.proposals) {
      expect(new Date(proposal.proposedEndAt).getTime()).toBeLessThanOrEqual(
        new Date("2026-07-13T15:00:00.000Z").getTime(),
      );
    }
  });

  it("returns warnings for unestimated tasks", () => {
    const result = generatePlanningProposals(
      baseInput({
        tasks: [
          task({
            dueAt: "2026-07-13T23:59:00.000Z",
            estimatedMinutes: null,
            remainingMinutes: null,
          }),
        ],
      }),
    );

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.proposals.length).toBe(0);
  });

  it("proposes estimated canvas tasks", () => {
    const result = generatePlanningProposals(
      baseInput({
        tasks: [
          task({
            id: "canvas-1",
            title: "Canvas assignment",
            source: "canvas",
            relatedEventId: "event-1",
            remainingMinutes: 60,
          }),
        ],
      }),
    );

    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.proposals[0].taskId).toBe("canvas-1");
  });

  it("skips unestimated canvas tasks", () => {
    const result = generatePlanningProposals(
      baseInput({
        tasks: [
          task({
            id: "canvas-1",
            title: "Canvas assignment",
            source: "canvas",
            relatedEventId: "event-1",
            estimatedMinutes: null,
            remainingMinutes: null,
          }),
        ],
      }),
    );

    expect(result.proposals.length).toBe(0);
    expect(result.warnings.some((w) => w.includes("no estimate"))).toBe(true);
  });
});
