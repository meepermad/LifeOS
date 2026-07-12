import { afterEach, describe, expect, it, vi } from "vitest";

const baseEnv = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  APP_ALLOWED_EMAIL: "user@example.com",
};

async function loadEnvModule(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  Object.entries(baseEnv).forEach(([key, value]) => {
    vi.stubEnv(key, value);
  });
  return import("@/lib/security/env");
}

describe("validateAppUrlForEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows localhost HTTP during development", async () => {
    const envModule = await loadEnvModule("development");
    expect(() =>
      envModule.validateAppUrlForEnvironment("http://localhost:3000"),
    ).not.toThrow();
    expect(envModule.getPublicEnv().NEXT_PUBLIC_APP_URL).toBe(
      "http://localhost:3000",
    );
  });

  it("requires HTTPS in production", async () => {
    const envModule = await loadEnvModule("production");
    expect(() =>
      envModule.validateAppUrlForEnvironment("http://localhost:3000"),
    ).toThrow(/HTTPS in production/i);
    expect(() => envModule.getPublicEnv()).toThrow(/HTTPS in production/i);
  });

  it("accepts HTTPS production URLs", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lifeos.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", baseEnv.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      baseEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    const envModule = await import("@/lib/security/env");
    expect(envModule.getPublicEnv().NEXT_PUBLIC_APP_URL).toBe(
      "https://lifeos.example.com",
    );
  });
});

describe("server-only variable isolation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not expose server secrets in public env", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("VAPID_PRIVATE_KEY", "vapid-private");
    const envModule = await loadEnvModule("test");
    const publicEnv = envModule.getPublicEnv();

    expect(publicEnv).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(publicEnv).not.toHaveProperty("CRON_SECRET");
    expect(publicEnv).not.toHaveProperty("VAPID_PRIVATE_KEY");
    expect(publicEnv).not.toHaveProperty("TOKEN_ENCRYPTION_KEY");
  });
});

describe("optional Microsoft variables while disabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not require Microsoft env vars when integration is disabled", async () => {
    vi.stubEnv("MICROSOFT_INTEGRATION_ENABLED", "false");
    const envModule = await loadEnvModule("test");
    expect(() => envModule.getServerEnv()).not.toThrow();
    expect(() => envModule.getMicrosoftConfig()).toThrow();
  });
});
