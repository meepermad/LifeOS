import { describe, expect, it } from "vitest";
import { isShelfCandidate } from "@/lib/planning/task-shelf";
import type { TaskRow } from "@/types/domain";

/**
 * Shelf idempotency / remaining work is enforced in
 * getTaskFocusScheduleSummaries (pending proposals) and
 * scheduleTaskFromShelfAction (reject remaining <= 0, clientRequestId).
 * Pure eligibility mirrors that gate.
 */
function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Essay",
    description: null,
    due_at: "2026-07-20T04:59:00.000Z",
    earliest_start_at: null,
    estimated_minutes: 120,
    remaining_minutes: 120,
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

describe("task shelf idempotency gates", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  it("treats remaining fully covered by pending proposals as ineligible", () => {
    const remainingAfterPending = 0;
    expect(isShelfCandidate(makeTask(), remainingAfterPending, now)).toBe(
      false,
    );
  });

  it("keeps partially covered tasks eligible", () => {
    expect(isShelfCandidate(makeTask(), 45, now)).toBe(true);
  });
});
