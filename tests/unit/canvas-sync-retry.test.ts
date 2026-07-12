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

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/data/connections", () => ({
  getCanvasConnectionWithCredentials: vi.fn(),
}));

import { fetchCanvasFeed } from "@/lib/integrations/canvas/fetch-feed";
import { syncCanvasCalendar, syncCanvasForUser } from "@/lib/integrations/canvas/sync";
import {
  claimConnectionForSync,
  getConnectionWithCredentials,
  markConnectionSyncError,
  markConnectionSyncSuccess,
  getCanvasCalendarForUser,
  getSyncStateForConnection,
  listCanvasEventsByExternalIds,
  upsertSyncState,
} from "@/lib/integrations/canvas/sync-data";
import { getCanvasConnectionWithCredentials } from "@/lib/data/connections";

const ctx = { client: {} as never, userId: "user-1" };

function buildConnection(status: string, lastError: string | null = null) {
  return {
    id: "connection-1",
    user_id: "user-1",
    provider: "canvas_ics",
    display_name: "Canvas ICS",
    encrypted_credentials: "encrypted",
    status,
    last_sync_attempt: "2026-07-11T08:00:00.000Z",
    last_successful_sync: "2026-07-10T08:00:00.000Z",
    last_sync_trigger: "manual" as const,
    last_error: lastError,
    external_tenant_id: null,
    external_home_account_id: null,
    requires_reauthentication: false,
    credentials_version: 0,
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
  };
}

function mockSuccessfulSyncPipeline() {
  vi.mocked(getCanvasCalendarForUser).mockResolvedValue({
    id: "calendar-canvas",
    user_id: "user-1",
    source: "canvas",
    name: "Canvas",
  } as never);
  vi.mocked(getSyncStateForConnection).mockResolvedValue(null);
  vi.mocked(upsertSyncState).mockResolvedValue({} as never);
  vi.mocked(listCanvasEventsByExternalIds).mockResolvedValue([]);
  vi.mocked(fetchCanvasFeed).mockResolvedValue({
    body: "BEGIN:VCALENDAR\nEND:VCALENDAR",
    finalUrl: "https://canvas.example.edu/feed.ics",
  });
}

describe("canvas sync retry after failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(claimConnectionForSync).mockResolvedValue("claimed");
    mockSuccessfulSyncPipeline();
  });

  it("allows manual retry when connection status is error", async () => {
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(
      buildConnection("error", "Canvas synchronization failed"),
    );

    await syncCanvasForUser({
      ctx,
      connectionId: "connection-1",
      trigger: "manual",
    });

    expect(claimConnectionForSync).toHaveBeenCalledWith(ctx, "connection-1");
    expect(markConnectionSyncSuccess).toHaveBeenCalledWith(ctx, "connection-1", "manual");
    expect(markConnectionSyncError).not.toHaveBeenCalled();
  });

  it("allows scheduled retry when connection status is error", async () => {
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(
      buildConnection("error", "Previous synchronization did not complete"),
    );

    await syncCanvasForUser({
      ctx,
      connectionId: "connection-1",
      trigger: "scheduled",
    });

    expect(claimConnectionForSync).toHaveBeenCalledWith(ctx, "connection-1");
    expect(markConnectionSyncSuccess).toHaveBeenCalledWith(
      ctx,
      "connection-1",
      "scheduled",
    );
  });

  it("keeps connection retryable after a failed manual retry", async () => {
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(
      buildConnection("error", "Canvas synchronization failed"),
    );
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

  it("keeps connection retryable after a failed scheduled retry", async () => {
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(
      buildConnection("error", "Canvas synchronization failed"),
    );
    vi.mocked(fetchCanvasFeed).mockRejectedValue(new Error("network failure"));

    await expect(
      syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "scheduled" }),
    ).rejects.toThrow();

    expect(markConnectionSyncError).toHaveBeenCalledWith(
      ctx,
      "connection-1",
      "Canvas synchronization failed",
    );
  });

  it("rejects disconnected connections at claim time", async () => {
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(
      buildConnection("disconnected", null),
    );
    vi.mocked(claimConnectionForSync).mockResolvedValue("not_connected");

    await expect(
      syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "manual" }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(markConnectionSyncSuccess).not.toHaveBeenCalled();
    expect(markConnectionSyncError).not.toHaveBeenCalled();
  });

  it("reclaims stale syncing claims for retry", async () => {
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(
      buildConnection("syncing", null),
    );
    vi.mocked(claimConnectionForSync).mockResolvedValue("claimed");

    await syncCanvasForUser({ ctx, connectionId: "connection-1", trigger: "scheduled" });

    expect(claimConnectionForSync).toHaveBeenCalledWith(ctx, "connection-1");
    expect(markConnectionSyncSuccess).toHaveBeenCalled();
  });

  it("manual syncCanvasCalendar retries error-status connections", async () => {
    vi.mocked(getCanvasConnectionWithCredentials).mockResolvedValue(
      buildConnection("error", "Canvas synchronization failed"),
    );
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(
      buildConnection("error", "Canvas synchronization failed"),
    );

    await syncCanvasCalendar();

    expect(claimConnectionForSync).toHaveBeenCalled();
    expect(markConnectionSyncSuccess).toHaveBeenCalledWith(ctx, "connection-1", "manual");
  });
});
