import { describe, expect, it } from "vitest";
import {
  canExitInbox,
  isActionableWorkload,
  isDeferredHidden,
  isInboxTask,
  shouldAssignInboxAt,
} from "@/lib/tasks/triage";
import type { TaskRow } from "@/types/domain";

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Test",
    description: null,
    source: "manual",
    status: "open",
    priority: 3,
    difficulty: 3,
    due_at: null,
    earliest_start_at: null,
    estimated_minutes: null,
    remaining_minutes: null,
    actual_minutes: null,
    splittable: false,
    minimum_block_minutes: 30,
    related_event_id: null,
    external_task_id: null,
    source_content_hash: null,
    sync_managed: false,
    cancelled_by_sync: false,
    completed_at: null,
    created_at: "",
    updated_at: "",
    inbox_at: "2026-07-12T12:00:00.000Z",
    workflow_state: "actionable",
    waiting_reason: null,
    waiting_follow_up_at: null,
    deferred_until_at: null,
    ...overrides,
  } as TaskRow;
}

describe("isInboxTask", () => {
  it("returns true when inbox_at is set", () => {
    expect(isInboxTask(makeTask())).toBe(true);
  });

  it("returns false when inbox_at is null", () => {
    expect(isInboxTask(makeTask({ inbox_at: null }))).toBe(false);
  });
});

describe("canExitInbox", () => {
  it("exits when due_at is set", () => {
    expect(
      canExitInbox(makeTask({ due_at: "2026-07-15T12:00:00.000Z" })),
    ).toBe(true);
  });

  it("exits when a future focus block exists", () => {
    expect(canExitInbox(makeTask(), { hasFutureFocusBlock: true })).toBe(true);
  });

  it("exits for waiting, someday, and backlog workflow states", () => {
    expect(canExitInbox(makeTask({ workflow_state: "waiting" }))).toBe(true);
    expect(canExitInbox(makeTask({ workflow_state: "someday" }))).toBe(true);
    expect(canExitInbox(makeTask({ workflow_state: "backlog" }))).toBe(true);
  });

  it("exits when deferred_until_at is set", () => {
    expect(
      canExitInbox(
        makeTask({ deferred_until_at: "2026-07-20T12:00:00.000Z" }),
      ),
    ).toBe(true);
  });

  it("stays in inbox with no triage signals", () => {
    expect(canExitInbox(makeTask())).toBe(false);
  });
});

describe("isDeferredHidden", () => {
  it("hides tasks deferred to the future", () => {
    const now = new Date("2026-07-12T12:00:00.000Z");
    expect(
      isDeferredHidden(
        makeTask({ deferred_until_at: "2026-07-20T12:00:00.000Z" }),
        now,
      ),
    ).toBe(true);
  });

  it("does not hide tasks whose defer date has passed", () => {
    const now = new Date("2026-07-20T13:00:00.000Z");
    expect(
      isDeferredHidden(
        makeTask({ deferred_until_at: "2026-07-20T12:00:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });
});

describe("isActionableWorkload", () => {
  it("excludes inbox tasks", () => {
    expect(isActionableWorkload(makeTask())).toBe(false);
  });

  it("includes triaged actionable tasks", () => {
    expect(isActionableWorkload(makeTask({ inbox_at: null }))).toBe(true);
  });

  it("excludes waiting and deferred tasks", () => {
    expect(
      isActionableWorkload(
        makeTask({ inbox_at: null, workflow_state: "waiting" }),
      ),
    ).toBe(false);
    expect(
      isActionableWorkload(
        makeTask({
          inbox_at: null,
          deferred_until_at: "2026-07-20T12:00:00.000Z",
        }),
        new Date("2026-07-12T12:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("shouldAssignInboxAt", () => {
  it("allows inbox for manual tasks", () => {
    expect(shouldAssignInboxAt(makeTask())).toBe(true);
  });

  it("blocks inbox for sync-managed tasks", () => {
    expect(shouldAssignInboxAt(makeTask({ sync_managed: true }))).toBe(false);
  });
});
