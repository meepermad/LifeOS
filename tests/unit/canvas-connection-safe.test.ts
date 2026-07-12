import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getCanvasConnectionSafe } from "@/lib/data/connections";

describe("safe canvas connection responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAllowedUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    } as never);
  });

  it("never returns encrypted credentials or feed urls", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "connection-1",
        user_id: "user-1",
        provider: "canvas_ics",
        display_name: "Canvas ICS",
        status: "connected",
        last_sync_attempt: null,
        last_successful_sync: null,
        last_sync_trigger: "manual",
        last_error: null,
        created_at: "2026-07-11T00:00:00.000Z",
        updated_at: "2026-07-11T00:00:00.000Z",
      },
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
      })),
    } as never);

    const status = await getCanvasConnectionSafe();
    expect(status.isConfigured).toBe(true);
    expect(status.displayLabel).toBe("Canvas feed configured");
    expect(status.lastSyncTrigger).toBe("manual");
    expect(JSON.stringify(status)).not.toContain("encrypted");
    expect(JSON.stringify(status)).not.toContain("https://");
  });
});
