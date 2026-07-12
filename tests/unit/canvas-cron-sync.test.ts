import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getCronSecret: vi.fn(),
  listConnectedCanvasConnections: vi.fn(),
  syncCanvasForUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/security/env", () => ({
  getCronSecret: mocks.getCronSecret,
}));

vi.mock("@/lib/integrations/canvas/sync-data", () => ({
  listConnectedCanvasConnections: mocks.listConnectedCanvasConnections,
}));

vi.mock("@/lib/integrations/canvas/sync", () => ({
  syncCanvasForUser: mocks.syncCanvasForUser,
}));

import { POST } from "@/app/api/cron/canvas-sync/route";

describe("POST /api/cron/canvas-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronSecret.mockReturnValue("cron-secret");
    mocks.createAdminClient.mockReturnValue({ from: vi.fn() });
  });

  it("rejects missing cron secret", async () => {
    const response = await POST(new Request("http://localhost/api/cron/canvas-sync", {
      method: "POST",
    }));

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects incorrect cron secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/canvas-sync", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("accepts valid cron secret and returns safe aggregate counts", async () => {
    const adminClient = { from: vi.fn() };
    mocks.createAdminClient.mockReturnValue(adminClient);
    mocks.listConnectedCanvasConnections.mockResolvedValue([
      { id: "connection-1", user_id: "user-1" },
    ]);
    mocks.syncCanvasForUser.mockResolvedValue({
      events: { created: 2, updated: 1, unchanged: 0, cancelled: 0, warnings: 0 },
      tasks: {
        created: 2,
        updated: 1,
        unchanged: 0,
        cancelled: 0,
        preservedUserFields: 0,
      },
      warnings: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/cron/canvas-sync", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.syncCanvasForUser).toHaveBeenCalledWith({
      ctx: { client: adminClient, userId: "user-1" },
      connectionId: "connection-1",
      trigger: "scheduled",
    });

    const body = await response.json();
    expect(body).toEqual({
      connectionsProcessed: 1,
      connectionsSucceeded: 1,
      connectionsFailed: 0,
      eventsCreated: 2,
      eventsUpdated: 1,
      tasksCreated: 2,
      tasksUpdated: 1,
      warnings: 0,
    });
    expect(JSON.stringify(body)).not.toContain("user@");
    expect(JSON.stringify(body)).not.toContain("https://");
    expect(JSON.stringify(body)).not.toContain("Assignment");
  });

  it("continues processing when one connection fails", async () => {
    const adminClient = { from: vi.fn() };
    mocks.createAdminClient.mockReturnValue(adminClient);
    mocks.listConnectedCanvasConnections.mockResolvedValue([
      { id: "connection-1", user_id: "user-1" },
      { id: "connection-2", user_id: "user-2" },
    ]);
    mocks.syncCanvasForUser
      .mockRejectedValueOnce(new Error("sync failed"))
      .mockResolvedValueOnce({
        events: { created: 1, updated: 0, unchanged: 0, cancelled: 0, warnings: 0 },
        tasks: {
          created: 0,
          updated: 0,
          unchanged: 0,
          cancelled: 0,
          preservedUserFields: 0,
        },
        warnings: 0,
      });

    const response = await POST(
      new Request("http://localhost/api/cron/canvas-sync", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    const body = await response.json();
    expect(body.connectionsProcessed).toBe(2);
    expect(body.connectionsSucceeded).toBe(1);
    expect(body.connectionsFailed).toBe(1);
  });

  it("skips disconnected connections because they are not listed", async () => {
    mocks.createAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.listConnectedCanvasConnections.mockResolvedValue([]);

    const response = await POST(
      new Request("http://localhost/api/cron/canvas-sync", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    const body = await response.json();
    expect(body.connectionsProcessed).toBe(0);
    expect(mocks.syncCanvasForUser).not.toHaveBeenCalled();
  });

  it("processes error-status connections for scheduled retry", async () => {
    const adminClient = { from: vi.fn() };
    mocks.createAdminClient.mockReturnValue(adminClient);
    mocks.listConnectedCanvasConnections.mockResolvedValue([
      { id: "connection-error", user_id: "user-1" },
    ]);
    mocks.syncCanvasForUser.mockResolvedValue({
      events: { created: 0, updated: 1, unchanged: 0, cancelled: 0, warnings: 0 },
      tasks: {
        created: 0,
        updated: 0,
        unchanged: 0,
        cancelled: 0,
        preservedUserFields: 0,
      },
      warnings: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/cron/canvas-sync", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.syncCanvasForUser).toHaveBeenCalledWith({
      ctx: { client: adminClient, userId: "user-1" },
      connectionId: "connection-error",
      trigger: "scheduled",
    });

    const body = await response.json();
    expect(body.connectionsSucceeded).toBe(1);
  });

  it("counts failed scheduled retry without blocking future cron runs", async () => {
    mocks.createAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.listConnectedCanvasConnections.mockResolvedValue([
      { id: "connection-error", user_id: "user-1" },
    ]);
    mocks.syncCanvasForUser.mockRejectedValue(new Error("still failing"));

    const response = await POST(
      new Request("http://localhost/api/cron/canvas-sync", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    const body = await response.json();
    expect(body.connectionsProcessed).toBe(1);
    expect(body.connectionsFailed).toBe(1);
    expect(body.connectionsSucceeded).toBe(0);
  });
});
