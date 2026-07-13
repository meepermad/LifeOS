import { describe, expect, it } from "vitest";
import {
  isShelfCandidate,
  matchesShelfFilters,
} from "@/lib/planning/task-shelf";
import type { TaskRow } from "@/types/domain";

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Write report",
    description: null,
    due_at: "2026-07-15T04:59:00.000Z",
    earliest_start_at: null,
    estimated_minutes: 90,
    remaining_minutes: 90,
    actual_minutes: null,
    priority: 2,
    difficulty: 3,
    status: "open",
    splittable: true,
    minimum_block_minutes: 25,
    source: "manual",
    external_task_id: null,
    source_content_hash: null,
    cancelled_by_sync: false,
    related_event_id: null,
    course_id: null,
    sync_managed: false,
    workflow_state: "actionable",
    deferred_until_at: null,
    inbox_at: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("task shelf eligibility", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("accepts actionable tasks with unscheduled remaining work", () => {
    expect(isShelfCandidate(makeTask(), 45, now)).toBe(true);
  });

  it("rejects subtasks", () => {
    expect(
      isShelfCandidate(makeTask({ parent_task_id: "parent-1" }), 45, now),
    ).toBe(false);
  });

  it("rejects inbox tasks by default", () => {
    expect(
      isShelfCandidate(makeTask({ inbox_at: "2026-07-13T12:00:00.000Z" }), 45, now),
    ).toBe(false);
  });

  it("rejects fully scheduled tasks", () => {
    expect(isShelfCandidate(makeTask(), 0, now)).toBe(false);
  });

  it("filters overdue tasks", () => {
    const overdueTask = makeTask({ due_at: "2026-07-12T04:59:00.000Z" });
    expect(
      matchesShelfFilters(overdueTask, { overdue: true }, now, {
        isWeeklyPriority: false,
      }),
    ).toBe(true);
    expect(
      matchesShelfFilters(makeTask(), { overdue: true }, now, {
        isWeeklyPriority: false,
      }),
    ).toBe(false);
  });

  it("filters weekly priority tasks", () => {
    expect(
      matchesShelfFilters(makeTask(), { weeklyPriority: true }, now, {
        isWeeklyPriority: true,
      }),
    ).toBe(true);
    expect(
      matchesShelfFilters(makeTask(), { weeklyPriority: true }, now, {
        isWeeklyPriority: false,
      }),
    ).toBe(false);
  });
});
