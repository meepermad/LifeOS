import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConflictError } from "@/lib/errors/app-error";
import { computeElapsedSeconds } from "@/lib/data/time-entries";

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/data/tasks", () => ({
  getTaskById: vi.fn(),
}));

import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getTaskById } from "@/lib/data/tasks";
import { startTimer, getActiveTimer } from "@/lib/data/time-entries";

const mockUser = { id: "user-1", email: "user@example.com" };

describe("time entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAllowedUser).mockResolvedValue(mockUser as never);
    vi.mocked(getTaskById).mockResolvedValue({
      id: "task-1",
      title: "Networking lab",
    } as never);
  });

  it("computes elapsed seconds excluding pause segments", () => {
    const elapsed = computeElapsedSeconds(
      {
        id: "e1",
        user_id: "user-1",
        task_id: "task-1",
        task_title_snapshot: "Networking lab",
        started_at: "2026-07-11T10:00:00.000Z",
        ended_at: null,
        duration_seconds: null,
        entry_source: "timer",
        note: null,
        parent_entry_id: null,
        review_state: "valid",
        review_reason: null,
        reviewed_at: null,
        created_at: "2026-07-11T10:00:00.000Z",
        updated_at: "2026-07-11T10:00:00.000Z",
      },
      [
        {
          id: "p1",
          entry_id: "e1",
          paused_at: "2026-07-11T10:30:00.000Z",
          resumed_at: "2026-07-11T10:45:00.000Z",
        },
      ],
      new Date("2026-07-11T11:00:00.000Z"),
    );
    expect(elapsed).toBe(45 * 60);
  });

  it("rejects starting a second active timer", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "active",
        user_id: "user-1",
        task_id: "task-1",
        task_title_snapshot: "Existing",
        started_at: "2026-07-11T10:00:00.000Z",
        ended_at: null,
        duration_seconds: null,
        entry_source: "timer",
        note: null,
        parent_entry_id: null,
        created_at: "2026-07-11T10:00:00.000Z",
        updated_at: "2026-07-11T10:00:00.000Z",
      },
      error: null,
    });
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn((table: string) => {
      if (table === "task_time_entries") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ maybeSingle }),
              }),
            }),
          }),
        };
      }
      if (table === "timer_pause_segments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ order }),
          }),
        };
      }
      return {};
    });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await expect(startTimer("task-1")).rejects.toBeInstanceOf(ConflictError);
    await expect(getActiveTimer()).resolves.not.toBeNull();
  });
});
