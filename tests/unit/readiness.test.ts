import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCronSecret: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock("@/lib/security/env", () => ({
  getCronSecret: mocks.getCronSecret,
  getServerEnv: mocks.getServerEnv,
}));

import { GET } from "@/app/api/readiness/route";

describe("GET /api/readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronSecret.mockReturnValue("cron-secret");
    mocks.getServerEnv.mockReturnValue({
      NEXT_PUBLIC_APP_URL: "https://lifeos.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      APP_ALLOWED_EMAIL: "user@example.com",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      CRON_SECRET: "cron-secret",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "vapid-public",
      VAPID_PRIVATE_KEY: "vapid-private",
      VAPID_SUBJECT: "mailto:user@example.com",
      TOKEN_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      CANVAS_ALLOWED_HOSTNAMES: "canvas.example.edu",
    });
  });

  it("rejects missing cron secret before returning configuration checks", async () => {
    const response = await GET(
      new Request("http://localhost/api/readiness", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("AUTHENTICATION_ERROR");
  });

  it("returns boolean readiness checks without secret values", async () => {
    const response = await GET(
      new Request("http://localhost/api/readiness", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ready).toBe(true);
    expect(body.checks).toEqual({
      appUrl: true,
      supabasePublic: true,
      allowedEmail: true,
      serviceRole: true,
      cronSecret: true,
      vapid: true,
      canvasEncryption: true,
    });
    expect(JSON.stringify(body)).not.toContain("user@example.com");
    expect(JSON.stringify(body)).not.toContain("service-role");
    expect(JSON.stringify(body)).not.toContain("vapid-private");
  });
});
