import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCanvasTaskContentHash,
  syncCanvasTasksForDeadlineEvents,
} from "@/lib/integrations/canvas/task-sync";
import type { CanvasEventForSync } from "@/lib/integrations/canvas/sync-data";

vi.mock("@/lib/integrations/canvas/sync-data", () => ({
  listCanvasTasksForSync: vi.fn(),
  listCanvasTasksByRelatedEventIds: vi.fn(),
  batchInsertCanvasTasks: vi.fn(),
  batchUpdateCanvasTasks: vi.fn(),
  cancelSyncManagedTasksForEvents: vi.fn(),
}));

import {
  batchInsertCanvasTasks,
  batchUpdateCanvasTasks,
  listCanvasTasksByRelatedEventIds,
  listCanvasTasksForSync,
} from "@/lib/integrations/canvas/sync-data";

const ctx = { client: {} as never, userId: "user-1" };

const deadlineEvent: CanvasEventForSync = {
  id: "event-1",
  external_event_id: "canvas-uid-1",
  title: "Assignment 3 due",
  description: "Submit homework",
  end_at: "2026-07-20T04:59:59.000Z",
  status: "confirmed",
  event_type: "deadline",
};

function buildExistingTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Assignment 3 due",
    description: "Submit homework",
    source: "canvas",
    external_task_id: "canvas-uid-1",
    due_at: "2026-07-20T04:59:59.000Z",
    earliest_start_at: null,
    estimated_minutes: null,
    remaining_minutes: null,
    actual_minutes: null,
    priority: 3,
    difficulty: 3,
    status: "open",
    splittable: true,
    minimum_block_minutes: 25,
    related_event_id: "event-1",
    sync_managed: true,
    cancelled_by_sync: false,
    source_content_hash: buildCanvasTaskContentHash({
      title: deadlineEvent.title,
      description: deadlineEvent.description,
      dueAt: deadlineEvent.end_at,
      externalTaskId: deadlineEvent.external_event_id,
      relatedEventId: deadlineEvent.id,
      eventStatus: deadlineEvent.status,
    }),
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("buildCanvasTaskContentHash", () => {
  it("is stable for identical input", () => {
    const input = {
      title: "Assignment",
      description: null,
      dueAt: "2026-07-20T04:59:59.000Z",
      externalTaskId: "uid-1",
      relatedEventId: "event-1",
      eventStatus: "confirmed",
    };
    expect(buildCanvasTaskContentHash(input)).toBe(buildCanvasTaskContentHash(input));
  });

  it("changes when due date changes", () => {
    const base = {
      title: "Assignment",
      description: null,
      dueAt: "2026-07-20T04:59:59.000Z",
      externalTaskId: "uid-1",
      relatedEventId: "event-1",
      eventStatus: "confirmed",
    };
    const changed = { ...base, dueAt: "2026-07-21T04:59:59.000Z" };
    expect(buildCanvasTaskContentHash(base)).not.toBe(
      buildCanvasTaskContentHash(changed),
    );
  });
});

describe("syncCanvasTasksForDeadlineEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([]);
    vi.mocked(listCanvasTasksByRelatedEventIds).mockResolvedValue([]);
    vi.mocked(batchInsertCanvasTasks).mockResolvedValue();
    vi.mocked(batchUpdateCanvasTasks).mockResolvedValue();
  });

  it("creates a task for a deadline event with null estimates", async () => {
    const result = await syncCanvasTasksForDeadlineEvents(ctx, [deadlineEvent]);

    expect(result.created).toBe(1);
    expect(batchInsertCanvasTasks).toHaveBeenCalledWith(ctx, [
      expect.objectContaining({
        source: "canvas",
        external_task_id: "canvas-uid-1",
        related_event_id: "event-1",
        estimated_minutes: null,
        remaining_minutes: null,
        priority: 3,
        difficulty: 3,
        status: "open",
        sync_managed: true,
      }),
    ]);
  });

  it("does not create duplicate tasks on unchanged resync", async () => {
    const existing = buildExistingTask();
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([existing]);

    const result = await syncCanvasTasksForDeadlineEvents(ctx, [deadlineEvent]);

    expect(result.unchanged).toBe(1);
    expect(result.created).toBe(0);
    expect(batchInsertCanvasTasks).not.toHaveBeenCalled();
    expect(batchUpdateCanvasTasks).not.toHaveBeenCalled();
  });

  it("reuses manually converted tasks by external_task_id", async () => {
    const existing = buildExistingTask({
      estimated_minutes: 90,
      remaining_minutes: 90,
      sync_managed: false,
    });
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([existing]);

    const updatedEvent = { ...deadlineEvent, title: "Assignment 3 due (updated)" };
    const result = await syncCanvasTasksForDeadlineEvents(ctx, [updatedEvent]);

    expect(result.updated).toBe(1);
    expect(batchUpdateCanvasTasks).toHaveBeenCalledWith(ctx, [
      expect.objectContaining({
        id: "task-1",
        title: "Assignment 3 due (updated)",
        sync_managed: true,
      }),
    ]);
    expect(result.preservedUserFields).toBe(1);
  });

  it("preserves user estimates on resync", async () => {
    const existing = buildExistingTask({
      estimated_minutes: 120,
      remaining_minutes: 60,
      priority: 1,
      difficulty: 5,
    });
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([existing]);

    const updatedEvent = { ...deadlineEvent, title: "Renamed assignment" };
    await syncCanvasTasksForDeadlineEvents(ctx, [updatedEvent]);

    const updatePayload = vi.mocked(batchUpdateCanvasTasks).mock.calls[0]?.[1]?.[0];
    expect(updatePayload).not.toHaveProperty("estimated_minutes");
    expect(updatePayload).not.toHaveProperty("remaining_minutes");
    expect(updatePayload).not.toHaveProperty("priority");
  });

  it("cancels active sync-managed tasks when event is cancelled", async () => {
    const existing = buildExistingTask();
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([existing]);

    const cancelledEvent = { ...deadlineEvent, status: "cancelled" };
    const result = await syncCanvasTasksForDeadlineEvents(ctx, [cancelledEvent]);

    expect(result.updated).toBe(1);
    expect(result.cancelled).toBe(1);
    expect(batchUpdateCanvasTasks).toHaveBeenCalledWith(ctx, [
      expect.objectContaining({
        status: "cancelled",
        cancelled_by_sync: true,
      }),
    ]);
  });

  it("does not cancel completed tasks", async () => {
    const existing = buildExistingTask({
      status: "completed",
      completed_at: "2026-07-10T00:00:00.000Z",
    });
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([existing]);

    const cancelledEvent = { ...deadlineEvent, status: "cancelled" };
    const result = await syncCanvasTasksForDeadlineEvents(ctx, [cancelledEvent]);

    expect(result.cancelled).toBe(0);
    const updatePayload = vi.mocked(batchUpdateCanvasTasks).mock.calls[0]?.[1]?.[0];
    expect(updatePayload?.status).toBeUndefined();
  });

  it("reopens sync-cancelled tasks when assignment returns", async () => {
    const existing = buildExistingTask({
      status: "cancelled",
      cancelled_by_sync: true,
      source_content_hash: "old-hash",
    });
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([existing]);

    const result = await syncCanvasTasksForDeadlineEvents(ctx, [deadlineEvent]);

    expect(result.updated).toBe(1);
    expect(batchUpdateCanvasTasks).toHaveBeenCalledWith(ctx, [
      expect.objectContaining({
        status: "open",
        cancelled_by_sync: false,
      }),
    ]);
  });

  it("does not reopen user-cancelled tasks", async () => {
    const existing = buildExistingTask({
      status: "cancelled",
      cancelled_by_sync: false,
      source_content_hash: "old-hash",
    });
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([existing]);

    await syncCanvasTasksForDeadlineEvents(ctx, [deadlineEvent]);

    const updatePayload = vi.mocked(batchUpdateCanvasTasks).mock.calls[0]?.[1]?.[0];
    expect(updatePayload?.status).toBeUndefined();
  });
});
