import { describe, expect, it, vi } from "vitest";
import {
  listConnectedCanvasConnections,
  markConnectionSyncError,
  markConnectionSyncSuccess,
} from "@/lib/integrations/canvas/sync-data";

describe("canvas sync retry data layer", () => {
  it("listConnectedCanvasConnections queries connected and error statuses", async () => {
    const inMock = vi.fn().mockReturnValue({
      not: vi.fn().mockResolvedValue({
        data: [
          { id: "connection-connected", user_id: "user-1" },
          { id: "connection-error", user_id: "user-1" },
        ],
        error: null,
      }),
    });

    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: inMock,
          })),
        })),
      })),
    };

    const result = await listConnectedCanvasConnections({
      client: client as never,
      userId: "",
    });

    expect(inMock).toHaveBeenCalledWith("status", ["connected", "error"]);
    expect(result).toEqual([
      { id: "connection-connected", user_id: "user-1" },
      { id: "connection-error", user_id: "user-1" },
    ]);
  });

  it("markConnectionSyncSuccess restores connected and clears last_error", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    await markConnectionSyncSuccess(
      { client: { from: vi.fn(() => ({ update })) } as never, userId: "user-1" },
      "connection-1",
      "manual",
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "connected",
        last_error: null,
        last_sync_trigger: "manual",
      }),
    );
  });

  it("markConnectionSyncError keeps connection in error state for later retry", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    await markConnectionSyncError(
      { client: { from: vi.fn(() => ({ update })) } as never, userId: "user-1" },
      "connection-1",
      "Canvas synchronization failed",
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        last_error: "Canvas synchronization failed",
      }),
    );
  });
});
