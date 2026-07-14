import { describe, expect, it } from "vitest";
import { buildWaitingFollowupDedupKey } from "@/lib/notifications/scheduling";
import { isShelfCandidate } from "@/lib/planning/task-shelf";
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

describe("phase13 notification hardening", () => {
  it("builds waiting follow-up dedup keys per task episode", () => {
    expect(
      buildWaitingFollowupDedupKey("user-1", "task-42", "2026-07-12"),
    ).toBe("waiting_followup:user-1:task-42:2026-07-12");
  });
});

describe("task shelf remaining work", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("rejects when remaining after pending proposals is zero", () => {
    expect(isShelfCandidate(makeTask(), 0, now)).toBe(false);
  });

  it("accepts when unscheduled remaining is positive", () => {
    expect(isShelfCandidate(makeTask(), 15, now)).toBe(true);
  });
});
