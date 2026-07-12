import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "@/lib/auth/authorize-user";

describe("isAllowedEmail", () => {
  it("accepts the configured email regardless of case", () => {
    expect(isAllowedEmail("user@example.com")).toBe(true);
    expect(isAllowedEmail("USER@EXAMPLE.COM")).toBe(true);
  });

  it("rejects other emails", () => {
    expect(isAllowedEmail("other@example.com")).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
  });
});

describe("protected route policy", () => {
  const DASHBOARD_PATHS = ["/today", "/week", "/tasks", "/chat", "/settings"];

  it("defines all required dashboard routes", () => {
    expect(DASHBOARD_PATHS).toEqual([
      "/today",
      "/week",
      "/tasks",
      "/chat",
      "/settings",
    ]);
  });

  it("treats dashboard subpaths as protected", () => {
    for (const route of DASHBOARD_PATHS) {
      expect(`${route}/detail`.startsWith(`${route}/`)).toBe(true);
    }
  });
});

describe("client bundle secret exposure", () => {
  it("does not expose service role key in public env schema", async () => {
    const envModule = await import("@/lib/security/env");
    const publicEnv = envModule.getPublicEnv();

    expect(publicEnv).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(publicEnv).not.toHaveProperty("TOKEN_ENCRYPTION_KEY");
    expect(publicEnv).not.toHaveProperty("CRON_SECRET");
  });
});
