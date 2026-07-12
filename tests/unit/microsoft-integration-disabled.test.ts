import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAllowedUser: vi.fn(),
  getMicrosoftConfig: vi.fn(),
  isMicrosoftIntegrationEnabled: vi.fn(() => false),
  getCronSecret: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: mocks.requireAllowedUser,
}));

vi.mock("@/lib/security/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/env")>(
    "@/lib/security/env",
  );
  return {
    ...actual,
    getMicrosoftConfig: mocks.getMicrosoftConfig,
    getCronSecret: mocks.getCronSecret,
    getPublicEnv: vi.fn(() => ({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" })),
  };
});

vi.mock("@/lib/integrations/microsoft/feature-flag", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/microsoft/feature-flag")>(
    "@/lib/integrations/microsoft/feature-flag",
  );
  return {
    ...actual,
    isMicrosoftIntegrationEnabled: mocks.isMicrosoftIntegrationEnabled,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

describe("microsoft integration disabled routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMicrosoftIntegrationEnabled.mockReturnValue(false);
  });

  it("returns a safe disabled response from OAuth start without loading config", async () => {
    const { GET } = await import("@/app/api/auth/microsoft/start/route");
    const response = await GET();

    expect(response.status).toBe(404);
    expect(mocks.requireAllowedUser).not.toHaveBeenCalled();
    expect(mocks.getMicrosoftConfig).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MICROSOFT_INTEGRATION_DISABLED" },
    });
  });

  it("returns a safe disabled response from OAuth callback without loading config", async () => {
    const { GET } = await import("@/app/api/auth/microsoft/callback/route");
    const response = await GET(
      new Request("http://localhost/api/auth/microsoft/callback?code=test&state=test"),
    );

    expect(response.status).toBe(404);
    expect(mocks.requireAllowedUser).not.toHaveBeenCalled();
    expect(mocks.getMicrosoftConfig).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MICROSOFT_INTEGRATION_DISABLED" },
    });
  });

  it("returns a safe disabled cron response without admin client", async () => {
    const { POST } = await import("@/app/api/cron/microsoft-sync/route");
    const response = await POST(
      new Request("http://localhost/api/cron/microsoft-sync", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getCronSecret).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      enabled: false,
      connectionsProcessed: 0,
      connectionsSucceeded: 0,
      connectionsFailed: 0,
      calendarsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsCancelled: 0,
      eventsUnchanged: 0,
      warnings: 0,
    });
  });
});

describe("microsoft integration enabled routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMicrosoftIntegrationEnabled.mockReturnValue(true);
    mocks.getCronSecret.mockReturnValue("cron-secret");
  });

  it("allows cron route to proceed past the feature flag when enabled", async () => {
    const { POST } = await import("@/app/api/cron/microsoft-sync/route");
    const response = await POST(
      new Request("http://localhost/api/cron/microsoft-sync", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.getCronSecret).toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
