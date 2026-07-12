import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/errors/app-error";

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { updateEvent } from "@/lib/data/events";

const mockUser = { id: "user-1", email: "user@example.com" };

describe("microsoft authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAllowedUser).mockResolvedValue(mockUser as never);
  });

  it("rejects direct read-only Microsoft event mutation", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "event-1",
        user_id: "user-1",
        calendar_id: "calendar-1",
        is_read_only: true,
        source: "microsoft",
      },
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single,
            })),
          })),
        })),
      })),
    } as never);

    await expect(
      updateEvent("event-1", {
        title: "Changed",
        description: null,
        location: null,
        startAt: "2026-07-15T14:00:00.000Z",
        endAt: "2026-07-15T15:00:00.000Z",
        allDay: false,
        status: "confirmed",
        eventType: "meeting",
        calendarId: "calendar-1",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
