import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileReclassifiedCanvasTasks } from "@/lib/integrations/canvas/task-sync";
import type { NormalizedCanvasEvent } from "@/lib/integrations/canvas/schemas";

vi.mock("@/lib/integrations/canvas/sync-data", () => ({
  listCanvasTasksForSync: vi.fn(),
  batchUpdateCanvasTasks: vi.fn(),
}));

import {
  batchUpdateCanvasTasks,
  listCanvasTasksForSync,
} from "@/lib/integrations/canvas/sync-data";

const ctx = { client: {} as never, userId: "user-1" };

function buildTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Assignment 3 due",
    description: "Submit homework",
    source: "canvas",
    external_task_id: "canvas-uid-1",
    due_at: "2026-07-20T04:59:59.000Z",
    earliest_start_at: null,
    estimated_minutes: 120,
    remaining_minutes: 60,
    actual_minutes: 30,
    priority: 2,
    difficulty: 4,
    status: "open",
    splittable: false,
    minimum_block_minutes: 30,
    related_event_id: "event-1",
    sync_managed: true,
    cancelled_by_sync: false,
    source_content_hash: "hash",
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

function buildParsedEvent(
  eventType: NormalizedCanvasEvent["eventType"],
): NormalizedCanvasEvent {
  return {
    externalEventId: "canvas-uid-1",
    title: eventType === "class" ? "Lecture 5" : "Assignment 3 due",
    description: null,
    location: null,
    startAt: "2026-07-15T14:00:00.000Z",
    endAt: "2026-07-15T15:00:00.000Z",
    allDay: false,
    status: "confirmed",
    eventType,
    externalUpdatedAt: null,
    contentHash: "event-hash",
  };
}

describe("reconcileReclassifiedCanvasTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([]);
    vi.mocked(batchUpdateCanvasTasks).mockResolvedValue();
  });

  it("cancels active sync-managed task when deadline becomes class", async () => {
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([buildTask()]);

    const count = await reconcileReclassifiedCanvasTasks(ctx, {
      parsedEvents: [buildParsedEvent("class")],
      feedTrustworthy: true,
    });

    expect(count).toBe(1);
    expect(batchUpdateCanvasTasks).toHaveBeenCalledWith(ctx, [
      expect.objectContaining({
        status: "cancelled",
        cancelled_by_sync: true,
      }),
    ]);
    const updatePayload = vi.mocked(batchUpdateCanvasTasks).mock.calls[0]?.[1]?.[0];
    expect(updatePayload).not.toHaveProperty("estimated_minutes");
    expect(updatePayload).not.toHaveProperty("remaining_minutes");
  });

  it("cancels active sync-managed task when deadline becomes other", async () => {
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([buildTask()]);

    const count = await reconcileReclassifiedCanvasTasks(ctx, {
      parsedEvents: [buildParsedEvent("other")],
      feedTrustworthy: true,
    });

    expect(count).toBe(1);
  });

  it("preserves completed tasks", async () => {
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([
      buildTask({ status: "completed", completed_at: "2026-07-10T00:00:00.000Z" }),
    ]);

    const count = await reconcileReclassifiedCanvasTasks(ctx, {
      parsedEvents: [buildParsedEvent("class")],
      feedTrustworthy: true,
    });

    expect(count).toBe(0);
    expect(batchUpdateCanvasTasks).not.toHaveBeenCalled();
  });

  it("preserves user-cancelled tasks", async () => {
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([
      buildTask({ status: "cancelled", cancelled_by_sync: false }),
    ]);

    const count = await reconcileReclassifiedCanvasTasks(ctx, {
      parsedEvents: [buildParsedEvent("class")],
      feedTrustworthy: true,
    });

    expect(count).toBe(0);
  });

  it("preserves non-sync-managed tasks", async () => {
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([
      buildTask({ sync_managed: false }),
    ]);

    const count = await reconcileReclassifiedCanvasTasks(ctx, {
      parsedEvents: [buildParsedEvent("class")],
      feedTrustworthy: true,
    });

    expect(count).toBe(0);
  });

  it("does not cancel when feed is not trustworthy", async () => {
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([buildTask()]);

    const count = await reconcileReclassifiedCanvasTasks(ctx, {
      parsedEvents: [buildParsedEvent("class")],
      feedTrustworthy: false,
    });

    expect(count).toBe(0);
    expect(listCanvasTasksForSync).not.toHaveBeenCalled();
  });

  it("does not cancel when UID remains a deadline", async () => {
    vi.mocked(listCanvasTasksForSync).mockResolvedValue([buildTask()]);

    const count = await reconcileReclassifiedCanvasTasks(ctx, {
      parsedEvents: [buildParsedEvent("deadline")],
      feedTrustworthy: true,
    });

    expect(count).toBe(0);
  });
});
