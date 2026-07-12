import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/errors/app-error";

vi.mock("@/lib/security/credential-encryption", () => ({
  decryptCredential: vi.fn(() => "https://canvas.example.edu/feed.ics"),
}));

vi.mock("@/lib/integrations/canvas/fetch-feed", () => ({
  fetchCanvasFeed: vi.fn(),
}));

vi.mock("@/lib/integrations/canvas/parse-feed", () => ({
  parseCanvasFeed: vi.fn(() => ({ events: [], warnings: 0 })),
}));

vi.mock("@/lib/integrations/canvas/sync-data", () => ({
  claimConnectionForSync: vi.fn(),
  getConnectionWithCredentials: vi.fn(),
  markConnectionSyncSuccess: vi.fn(),
  markConnectionSyncError: vi.fn(),
  getCanvasCalendarForUser: vi.fn(),
  getSyncStateForConnection: vi.fn(),
  upsertSyncState: vi.fn(),
  upsertCanvasEvent: vi.fn(),
  cancelCanvasEventsNotInSet: vi.fn(),
  listCanvasEventsByExternalIds: vi.fn(),
}));

vi.mock("@/lib/integrations/canvas/task-sync", () => ({
  syncCanvasTasksForDeadlineEvents: vi.fn(async () => ({
    created: 0,
    updated: 0,
    unchanged: 0,
    cancelled: 0,
    preservedUserFields: 0,
  })),
  reconcileCancelledCanvasTasks: vi.fn(async () => 0),
  reconcileReclassifiedCanvasTasks: vi.fn(async () => 0),
}));

import { fetchCanvasFeed } from "@/lib/integrations/canvas/fetch-feed";
import { syncCanvasForUser } from "@/lib/integrations/canvas/sync";
import {
  claimConnectionForSync,
  getConnectionWithCredentials,
  getCanvasCalendarForUser,
  getSyncStateForConnection,
  listCanvasEventsByExternalIds,
  markConnectionSyncError,
  markConnectionSyncSuccess,
  upsertSyncState,
} from "@/lib/integrations/canvas/sync-data";

const connection = {
  id: "connection-1",
  user_id: "user-1",
  provider: "canvas_ics",
  display_name: "Canvas ICS",
  encrypted_credentials: "encrypted",
  status: "connected",
  last_sync_attempt: null,
  last_successful_sync: null,
  last_sync_trigger: null,
  last_error: null,
  external_tenant_id: null,
  external_home_account_id: null,
  requires_reauthentication: false,
  credentials_version: 0,
  created_at: "2026-07-11T00:00:00.000Z",
  updated_at: "2026-07-11T00:00:00.000Z",
};

const ctx = { client: {} as never, userId: "user-1" };

describe("canvas sync concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(connection);
    vi.mocked(claimConnectionForSync).mockResolvedValue("claimed");
    vi.mocked(fetchCanvasFeed).mockResolvedValue({
      body: "BEGIN:VCALENDAR\nEND:VCALENDAR",
      finalUrl: "https://canvas.example.edu/feed.ics",
    });
    vi.mocked(getCanvasCalendarForUser).mockResolvedValue({
      id: "calendar-canvas",
      user_id: "user-1",
      source: "canvas",
      name: "Canvas",
    } as never);
    vi.mocked(getSyncStateForConnection).mockResolvedValue(null);
    vi.mocked(upsertSyncState).mockResolvedValue({} as never);
    vi.mocked(listCanvasEventsByExternalIds).mockResolvedValue([]);
  });

  it("rejects when claim returns already_running", async () => {
    vi.mocked(claimConnectionForSync).mockResolvedValue("already_running");

    await expect(
      syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "manual" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("releases claim on success", async () => {
    await syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "scheduled" });

    expect(markConnectionSyncSuccess).toHaveBeenCalledWith(
      ctx,
      "connection-1",
      "scheduled",
    );
    expect(markConnectionSyncError).not.toHaveBeenCalled();
  });

  it("releases claim on failure", async () => {
    vi.mocked(fetchCanvasFeed).mockRejectedValue(new Error("network failure"));

    await expect(
      syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "manual" }),
    ).rejects.toThrow();

    expect(markConnectionSyncError).toHaveBeenCalledWith(
      ctx,
      "connection-1",
      "Canvas synchronization failed",
    );
    expect(markConnectionSyncSuccess).not.toHaveBeenCalled();
  });

  it("allows reclaim after stale claim result", async () => {
    vi.mocked(claimConnectionForSync).mockResolvedValue("claimed");

    await syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "scheduled" });

    expect(claimConnectionForSync).toHaveBeenCalledWith(ctx, "connection-1");
    expect(markConnectionSyncSuccess).toHaveBeenCalled();
  });

  it("manual and scheduled sync use the same claim path", async () => {
    await syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "manual" });
    await syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "scheduled" });

    expect(claimConnectionForSync).toHaveBeenCalledTimes(2);
  });
});
