import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/microsoft/graph-client", () => ({
  listGraphCalendars: vi.fn(),
  syncGraphCalendarDelta: vi.fn(),
}));

vi.mock("@/lib/integrations/microsoft/token-cache", () => ({
  createTokenCacheSession: vi.fn(),
  acquireGraphAccessToken: vi.fn(),
  persistTokenCacheIfChanged: vi.fn(),
  isInteractionRequiredError: vi.fn(() => false),
  markMicrosoftReauthenticationRequired: vi.fn(),
}));

vi.mock("@/lib/integrations/microsoft/sync-data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/microsoft/sync-data")>(
    "@/lib/integrations/microsoft/sync-data",
  );
  return {
    ...actual,
    claimConnectionForSync: vi.fn(),
    getMicrosoftConnectionWithCredentials: vi.fn(),
    listEnabledMicrosoftCalendars: vi.fn(),
    getSyncStateForCalendar: vi.fn(),
    upsertMicrosoftEvent: vi.fn(),
    upsertMicrosoftSyncState: vi.fn(),
    markConnectionSyncSuccess: vi.fn(),
    markConnectionSyncError: vi.fn(),
    clearMicrosoftSyncCursor: vi.fn(),
  };
});

import { syncMicrosoftForUser } from "@/lib/integrations/microsoft/sync";
import {
  acquireGraphAccessToken,
  createTokenCacheSession,
  persistTokenCacheIfChanged,
} from "@/lib/integrations/microsoft/token-cache";
import { syncGraphCalendarDelta } from "@/lib/integrations/microsoft/graph-client";
import {
  claimConnectionForSync,
  getMicrosoftConnectionWithCredentials,
  listEnabledMicrosoftCalendars,
  getSyncStateForCalendar,
  upsertMicrosoftEvent,
  upsertMicrosoftSyncState,
} from "@/lib/integrations/microsoft/sync-data";

const connection = {
  id: "connection-1",
  user_id: "user-1",
  provider: "microsoft",
  display_name: "Work account",
  encrypted_credentials: "encrypted",
  external_tenant_id: "tenant",
  external_home_account_id: "home-account",
  requires_reauthentication: false,
  credentials_version: 1,
  status: "connected",
  last_sync_attempt: null,
  last_successful_sync: null,
  last_sync_trigger: null,
  last_error: null,
  created_at: "2026-07-11T00:00:00.000Z",
  updated_at: "2026-07-11T00:00:00.000Z",
};

const ctx = { client: {} as never, userId: "user-1" };

describe("microsoft sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMicrosoftConnectionWithCredentials).mockResolvedValue(connection);
    vi.mocked(claimConnectionForSync).mockResolvedValue("claimed");
    vi.mocked(createTokenCacheSession).mockReturnValue({
      client: {} as never,
      accountHomeId: "home-account",
      credentialsVersion: 1,
    });
    vi.mocked(acquireGraphAccessToken).mockResolvedValue({
      accessToken: "token",
      authResult: {} as never,
    });
    vi.mocked(persistTokenCacheIfChanged).mockResolvedValue(connection);
    vi.mocked(listEnabledMicrosoftCalendars).mockResolvedValue([
      {
        id: "calendar-1",
        user_id: "user-1",
        connection_id: "connection-1",
        external_calendar_id: "graph-cal-1",
        name: "Calendar",
        source: "microsoft",
        is_visible: true,
        is_writable: false,
        sync_enabled: true,
        created_at: "2026-07-11T00:00:00.000Z",
        updated_at: "2026-07-11T00:00:00.000Z",
      },
    ]);
    vi.mocked(getSyncStateForCalendar).mockResolvedValue(null);
    vi.mocked(syncGraphCalendarDelta).mockResolvedValue({
      events: [
        {
          id: "event-1",
          subject: "Meeting",
          start: { dateTime: "2026-07-15T14:00:00.0000000", timeZone: "UTC" },
          end: { dateTime: "2026-07-15T15:00:00.0000000", timeZone: "UTC" },
        },
      ],
      deltaLink: "https://graph.microsoft.com/v1.0/delta?token=1",
      warnings: 0,
    });
    vi.mocked(upsertMicrosoftEvent).mockResolvedValue("created");
    vi.mocked(upsertMicrosoftSyncState).mockResolvedValue({} as never);
  });

  it("syncs enabled calendars and returns aggregate counts", async () => {
    const result = await syncMicrosoftForUser({
      ctx,
      connectionId: "connection-1",
      trigger: "manual",
    });

    expect(result.events.created).toBe(1);
    expect(result.calendars).toHaveLength(1);
    expect(upsertMicrosoftSyncState).toHaveBeenCalled();
  });

  it("is idempotent when upsert returns unchanged", async () => {
    vi.mocked(upsertMicrosoftEvent).mockResolvedValue("unchanged");

    const result = await syncMicrosoftForUser({
      ctx,
      connectionId: "connection-1",
      trigger: "manual",
    });

    expect(result.events.unchanged).toBe(1);
    expect(result.events.created).toBe(0);
  });

  it("rejects concurrent sync claims", async () => {
    vi.mocked(claimConnectionForSync).mockResolvedValue("already_running");

    await expect(
      syncMicrosoftForUser({
        ctx,
        connectionId: "connection-1",
        trigger: "manual",
      }),
    ).rejects.toThrow("already in progress");
  });
});
