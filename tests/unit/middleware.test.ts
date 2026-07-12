import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { middleware, shouldRunMiddleware } from "@/middleware";

describe("middleware static asset bypass", () => {
  it("does not run middleware for favicon and PWA assets", () => {
    expect(shouldRunMiddleware("/favicon.ico")).toBe(false);
    expect(shouldRunMiddleware("/favicon.png")).toBe(false);
    expect(shouldRunMiddleware("/icons/icon-192.png")).toBe(false);
    expect(shouldRunMiddleware("/sw.js")).toBe(false);
    expect(shouldRunMiddleware("/offline.html")).toBe(false);
    expect(shouldRunMiddleware("/manifest.webmanifest")).toBe(false);
    expect(shouldRunMiddleware("/_next/static/chunks/main.js")).toBe(false);
    expect(shouldRunMiddleware("/_next/image?url=%2Ficon.png")).toBe(false);
  });

  it("runs middleware for application routes", () => {
    expect(shouldRunMiddleware("/")).toBe(true);
    expect(shouldRunMiddleware("/today")).toBe(true);
    expect(shouldRunMiddleware("/login")).toBe(true);
    expect(shouldRunMiddleware("/api/protected/me")).toBe(true);
  });
});

describe("middleware configuration handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when middleware-required env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("APP_ALLOWED_EMAIL", "");

    const response = await middleware(
      new NextRequest("http://localhost/", { headers: new Headers() }),
    );

    expect(response.status).toBe(503);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("NEXT_PUBLIC");
    expect(JSON.stringify(body)).not.toContain("APP_ALLOWED_EMAIL");
  });
});
