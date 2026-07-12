import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getCronSecret: vi.fn(),
  isMicrosoftIntegrationEnabled: vi.fn(() => true),
  listConnectedMicrosoftConnections: vi.fn(),
  syncMicrosoftForUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/security/env", () => ({
  getCronSecret: mocks.getCronSecret,
}));

vi.mock("@/lib/integrations/microsoft/feature-flag", () => ({
  isMicrosoftIntegrationEnabled: mocks.isMicrosoftIntegrationEnabled,
}));

vi.mock("@/lib/integrations/microsoft/sync-data", () => ({
  listConnectedMicrosoftConnections: mocks.listConnectedMicrosoftConnections,
}));

vi.mock("@/lib/integrations/microsoft/sync", () => ({
  syncMicrosoftForUser: mocks.syncMicrosoftForUser,
}));

import { POST } from "@/app/api/cron/microsoft-sync/route";

describe("POST /api/cron/microsoft-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronSecret.mockReturnValue("cron-secret");
    mocks.createAdminClient.mockReturnValue({ from: vi.fn() });
  });

  it("rejects missing cron secret before admin access", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/microsoft-sync", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects incorrect cron secret before admin access", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/microsoft-sync", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("scopes scheduled sync to each connected user", async () => {
    mocks.listConnectedMicrosoftConnections.mockResolvedValue([
      { id: "conn-1", user_id: "user-1" },
    ]);
    mocks.syncMicrosoftForUser.mockResolvedValue({
      calendars: [{ calendarId: "cal-1", success: true, events: { created: 1, updated: 0, unchanged: 0, cancelled: 0, warnings: 0 } }],
      events: { created: 1, updated: 0, unchanged: 0, cancelled: 0, warnings: 0 },
      warnings: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/cron/microsoft-sync", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.syncMicrosoftForUser).toHaveBeenCalledWith({
      ctx: { client: expect.anything(), userId: "user-1" },
      connectionId: "conn-1",
      trigger: "scheduled",
    });
    await expect(response.json()).resolves.toMatchObject({ enabled: true });
  });
});
