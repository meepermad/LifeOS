import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateCanvasTaskEstimate } from "@/lib/data/tasks";

const mockUser = { id: "user-1", email: "test@example.com" };

const mockEvent = {
  id: "event-1",
  user_id: "user-1",
  title: "Assignment 1",
  description: null,
  source: "canvas",
  event_type: "deadline",
  external_event_id: "canvas-uid-1",
  end_at: "2026-07-20T04:59:59.000Z",
  is_read_only: true,
};

const mockLinkedTask = {
  id: "task-1",
  user_id: "user-1",
  title: "Assignment 1",
  description: null,
  source: "canvas",
  external_task_id: "canvas-uid-1",
  related_event_id: "event-1",
  due_at: "2026-07-20T04:59:59.000Z",
  estimated_minutes: null,
  remaining_minutes: null,
  priority: 3,
  difficulty: 3,
  splittable: true,
  minimum_block_minutes: 25,
  status: "open",
  sync_managed: true,
  cancelled_by_sync: false,
  source_content_hash: null,
};

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(async () => mockUser),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

function chain(result: unknown) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  return builder;
}

describe("updateCanvasTaskEstimate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-canvas events", async () => {
    mockSupabase.from.mockImplementation(() =>
      chain({ data: { ...mockEvent, source: "manual" }, error: null }),
    );

    await expect(
      updateCanvasTaskEstimate({
        eventId: "event-1",
        estimatedMinutes: 90,
      }),
    ).rejects.toThrow(/Only Canvas deadline events/);
  });

  it("requires an existing linked task", async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chain({ data: mockEvent, error: null });
      }
      return chain({ data: null, error: null });
    });

    await expect(
      updateCanvasTaskEstimate({
        eventId: "event-1",
        estimatedMinutes: 90,
      }),
    ).rejects.toThrow(/Sync Canvas first/);
  });

  it("updates remaining minutes from estimate", async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chain({ data: mockEvent, error: null });
      }
      if (call === 2) {
        return chain({ data: mockLinkedTask, error: null });
      }
      return chain({
        data: {
          ...mockLinkedTask,
          remaining_minutes: 90,
          estimated_minutes: 90,
        },
        error: null,
      });
    });

    const updated = await updateCanvasTaskEstimate({
      eventId: "event-1",
      estimatedMinutes: 90,
    });

    expect(updated.remaining_minutes).toBe(90);
    expect(updated.estimated_minutes).toBe(90);
  });
});
