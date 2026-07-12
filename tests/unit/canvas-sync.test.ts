import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldReconcileRemovals } from "@/lib/integrations/canvas/normalize";

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/security/credential-encryption", () => ({
  decryptCredential: vi.fn(() => "https://canvas.example.edu/feed.ics"),
}));

vi.mock("@/lib/integrations/canvas/fetch-feed", () => ({
  fetchCanvasFeed: vi.fn(),
}));

vi.mock("@/lib/data/connections", () => ({
  getCanvasConnectionWithCredentials: vi.fn(),
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
  syncCanvasTasksForDeadlineEvents: vi.fn(),
  reconcileCancelledCanvasTasks: vi.fn(),
  reconcileReclassifiedCanvasTasks: vi.fn(),
}));

import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { fetchCanvasFeed } from "@/lib/integrations/canvas/fetch-feed";
import { syncCanvasCalendar } from "@/lib/integrations/canvas/sync";
import { getCanvasConnectionWithCredentials } from "@/lib/data/connections";
import {
  claimConnectionForSync,
  getCanvasCalendarForUser,
  getConnectionWithCredentials,
  getSyncStateForConnection,
  upsertSyncState,
  cancelCanvasEventsNotInSet,
  listCanvasEventsByExternalIds,
  upsertCanvasEvent,
} from "@/lib/integrations/canvas/sync-data";
import {
  reconcileCancelledCanvasTasks,
  reconcileReclassifiedCanvasTasks,
  syncCanvasTasksForDeadlineEvents,
} from "@/lib/integrations/canvas/task-sync";

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), "tests/fixtures/canvas", name), "utf8");

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

const emptyTaskCounts = {
  created: 0,
  updated: 0,
  unchanged: 0,
  cancelled: 0,
  preservedUserFields: 0,
};

describe("canvas sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAllowedUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(createClient).mockResolvedValue({} as never);
    vi.mocked(getCanvasConnectionWithCredentials).mockResolvedValue(connection);
    vi.mocked(getConnectionWithCredentials).mockResolvedValue(connection);
    vi.mocked(claimConnectionForSync).mockResolvedValue("claimed");
    vi.mocked(getCanvasCalendarForUser).mockResolvedValue({
      id: "calendar-canvas",
      user_id: "user-1",
      source: "canvas",
      name: "Canvas",
    } as never);
    vi.mocked(getSyncStateForConnection).mockResolvedValue(null);
    vi.mocked(upsertSyncState).mockResolvedValue({} as never);
    vi.mocked(cancelCanvasEventsNotInSet).mockResolvedValue({ count: 0, eventIds: [] });
    vi.mocked(listCanvasEventsByExternalIds).mockResolvedValue([]);
    vi.mocked(syncCanvasTasksForDeadlineEvents).mockResolvedValue(emptyTaskCounts);
    vi.mocked(reconcileCancelledCanvasTasks).mockResolvedValue(0);
    vi.mocked(reconcileReclassifiedCanvasTasks).mockResolvedValue(0);
    vi.mocked(fetchCanvasFeed).mockResolvedValue({
      body: fixture("timed-event.ics"),
      finalUrl: "https://canvas.example.edu/feed.ics",
    });
  });

  it("creates events on first sync", async () => {
    vi.mocked(upsertCanvasEvent).mockResolvedValue("created");

    const result = await syncCanvasCalendar();
    expect(result.events.created).toBe(1);
    expect(result.events.updated).toBe(0);
    expect(result.events.unchanged).toBe(0);
    expect(syncCanvasTasksForDeadlineEvents).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      [],
    );
  });

  it("is idempotent on repeated sync", async () => {
    vi.mocked(upsertCanvasEvent).mockResolvedValue("unchanged");

    const result = await syncCanvasCalendar();
    expect(result.events.created).toBe(0);
    expect(result.events.updated).toBe(0);
    expect(result.events.unchanged).toBe(1);
  });

  it("updates changed events", async () => {
    vi.mocked(upsertCanvasEvent).mockResolvedValue("updated");

    const result = await syncCanvasCalendar();
    expect(result.events.updated).toBe(1);
  });

  it("returns nested task sync counts", async () => {
    vi.mocked(upsertCanvasEvent).mockResolvedValue("created");
    vi.mocked(syncCanvasTasksForDeadlineEvents).mockResolvedValue({
      created: 2,
      updated: 1,
      unchanged: 7,
      cancelled: 0,
      preservedUserFields: 3,
    });

    const result = await syncCanvasCalendar();
    expect(result.tasks.created).toBe(2);
    expect(result.tasks.updated).toBe(1);
    expect(result.tasks.unchanged).toBe(7);
    expect(result.tasks.preservedUserFields).toBe(3);
  });

  it("skips removal reconciliation for suspiciously small feeds", () => {
    expect(
      shouldReconcileRemovals({
        parsedEventCount: 1,
        previousEventCount: 20,
        warnings: 0,
      }),
    ).toBe(false);
  });

  it("reconciles removals for healthy feeds", async () => {
    vi.mocked(getSyncStateForConnection).mockResolvedValue({
      last_seen_event_count: 2,
    } as never);
    vi.mocked(upsertCanvasEvent).mockResolvedValue("unchanged");
    vi.mocked(cancelCanvasEventsNotInSet).mockResolvedValue({
      count: 1,
      eventIds: ["event-cancelled"],
    });
    vi.mocked(reconcileCancelledCanvasTasks).mockResolvedValue(1);
    vi.mocked(fetchCanvasFeed).mockResolvedValue({
      body: fixture("partial-window.ics"),
      finalUrl: "https://canvas.example.edu/feed.ics",
    });

    const result = await syncCanvasCalendar();
    expect(cancelCanvasEventsNotInSet).toHaveBeenCalled();
    expect(reconcileReclassifiedCanvasTasks).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      expect.objectContaining({ feedTrustworthy: true }),
    );
    expect(result.events.cancelled).toBe(1);
    expect(reconcileCancelledCanvasTasks).toHaveBeenCalled();
    expect(result.tasks.cancelled).toBe(1);
  });

  it("handles malformed feeds with warnings", async () => {
    vi.mocked(upsertCanvasEvent).mockResolvedValue("created");
    vi.mocked(fetchCanvasFeed).mockResolvedValue({
      body: fixture("malformed-entry.ics"),
      finalUrl: "https://canvas.example.edu/feed.ics",
    });

    const result = await syncCanvasCalendar();
    expect(result.events.created).toBe(1);
    expect(result.warnings).toBeGreaterThan(0);
  });

  it("rejects sync when claim returns already_running", async () => {
    vi.mocked(claimConnectionForSync).mockResolvedValue("already_running");

    await expect(syncCanvasCalendar()).rejects.toThrow(
      "Canvas synchronization is already in progress",
    );
  });
});

describe("shouldReconcileRemovals", () => {
  it("allows reconciliation for normal feeds", () => {
    expect(
      shouldReconcileRemovals({
        parsedEventCount: 5,
        previousEventCount: 6,
        warnings: 0,
      }),
    ).toBe(true);
  });
});
