import { describe, expect, it } from "vitest";
import {
  allocateTasks,
  compareTasks,
  getRelevantTasksForPeriod,
  getTaskWorkloadMinutes,
} from "@/lib/planning/task-allocation";
import type { PlanningTask } from "@/lib/planning/types";

const now = new Date("2026-07-13T12:00:00.000Z");

function task(partial: Partial<PlanningTask>): PlanningTask {
  return {
    id: partial.id ?? "task-1",
    title: partial.title ?? "Task",
    status: partial.status ?? "open",
    dueAt: partial.dueAt ?? null,
    earliestStartAt: partial.earliestStartAt ?? null,
    estimatedMinutes: partial.estimatedMinutes ?? null,
    remainingMinutes: partial.remainingMinutes ?? null,
    priority: partial.priority ?? 3,
    difficulty: partial.difficulty ?? 3,
    splittable: partial.splittable ?? true,
    minimumBlockMinutes: partial.minimumBlockMinutes ?? 25,
    source: partial.source ?? "manual",
    relatedEventId: partial.relatedEventId ?? null,
  };
}

describe("task allocation", () => {
  it("excludes completed and cancelled tasks via active filter", () => {
    const relevant = getRelevantTasksForPeriod({
      tasks: [
        task({ id: "open", status: "open", dueAt: "2026-07-13T23:59:00.000Z" }),
        task({ id: "done", status: "completed" }),
      ],
      dayKeys: ["2026-07-13"],
      now,
      periodType: "day",
    });

    expect(relevant.map((item) => item.id)).toEqual(["open"]);
  });

  it("prefers remaining minutes over estimated minutes", () => {
    expect(
      getTaskWorkloadMinutes(
        task({ estimatedMinutes: 120, remainingMinutes: 45 }),
      ),
    ).toBe(45);
  });

  it("sorts overdue tasks first", () => {
    const sorted = [
      task({ id: "future", dueAt: "2026-07-20T23:59:00.000Z", priority: 1 }),
      task({ id: "overdue", dueAt: "2026-07-10T23:59:00.000Z", priority: 5 }),
    ].sort((a, b) => compareTasks(a, b, now));

    expect(sorted[0].id).toBe("overdue");
  });

  it("respects earliest start restrictions", () => {
    const eligible = allocateTasks({
      tasks: [
        task({
          id: "later",
          estimatedMinutes: 60,
          earliestStartAt: "2026-07-15T00:00:00.000Z",
          dueAt: "2026-07-16T23:59:00.000Z",
        }),
      ],
      dayKeys: ["2026-07-13", "2026-07-14", "2026-07-15"],
      availableFocusByDay: new Map([
        ["2026-07-13", 120],
        ["2026-07-14", 120],
        ["2026-07-15", 120],
      ]),
      now,
      periodType: "week",
    });

    expect(eligible.perDayAllocations[0].allocatedMinutes).toBe(0);
    const allocatedOnEligibleDays = eligible.perDayAllocations
      .slice(1)
      .reduce((sum, day) => sum + day.allocatedMinutes, 0);
    expect(allocatedOnEligibleDays).toBeGreaterThan(0);
  });

  it("allocates non-splittable tasks on one day when possible", () => {
    const result = allocateTasks({
      tasks: [task({ id: "whole", estimatedMinutes: 90, splittable: false })],
      dayKeys: ["2026-07-13"],
      availableFocusByDay: new Map([["2026-07-13", 120]]),
      now,
      periodType: "day",
    });

    expect(result.allocatedTaskMinutes).toBe(90);
    expect(result.unallocatedTaskMinutes).toBe(0);
  });

  it("reports impossible tasks with unallocated minutes", () => {
    const result = allocateTasks({
      tasks: [
        task({
          id: "big",
          estimatedMinutes: 300,
          splittable: false,
          dueAt: "2026-07-13T23:59:00.000Z",
        }),
      ],
      dayKeys: ["2026-07-13"],
      availableFocusByDay: new Map([["2026-07-13", 60]]),
      now,
      periodType: "day",
    });

    expect(result.unallocatedTaskMinutes).toBe(300);
    expect(result.tasksImpossibleBeforeDeadline).toContain("big");
  });
});
