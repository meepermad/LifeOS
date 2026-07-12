import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMiddlewareEnv } from "@/lib/security/middleware-env";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  APP_ALLOWED_EMAIL: "user@example.com",
};

describe("parseMiddlewareEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only the middleware-required variables", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validEnv.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    vi.stubEnv("APP_ALLOWED_EMAIL", validEnv.APP_ALLOWED_EMAIL);

    const result = parseMiddlewareEnv();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validEnv);
    }
  });

  it("fails when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    vi.stubEnv("APP_ALLOWED_EMAIL", validEnv.APP_ALLOWED_EMAIL);

    expect(parseMiddlewareEnv().success).toBe(false);
  });

  it("fails when NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validEnv.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("APP_ALLOWED_EMAIL", validEnv.APP_ALLOWED_EMAIL);

    expect(parseMiddlewareEnv().success).toBe(false);
  });

  it("fails when APP_ALLOWED_EMAIL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validEnv.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    vi.stubEnv("APP_ALLOWED_EMAIL", "");

    expect(parseMiddlewareEnv().success).toBe(false);
  });

  it("does not require NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validEnv.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    vi.stubEnv("APP_ALLOWED_EMAIL", validEnv.APP_ALLOWED_EMAIL);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);

    expect(parseMiddlewareEnv().success).toBe(true);
  });
});

describe("getSupabasePublicEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("requires only Supabase public variables", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validEnv.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);

    const envModule = await import("@/lib/security/env");
    expect(envModule.getSupabasePublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: validEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        validEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it("does not require NEXT_PUBLIC_APP_URL for getServerEnv", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", validEnv.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      validEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    vi.stubEnv("APP_ALLOWED_EMAIL", validEnv.APP_ALLOWED_EMAIL);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);

    const envModule = await import("@/lib/security/env");
    expect(() => envModule.getServerEnv()).not.toThrow();
    expect(envModule.getServerEnv().NEXT_PUBLIC_APP_URL).toBeUndefined();
  });
});
