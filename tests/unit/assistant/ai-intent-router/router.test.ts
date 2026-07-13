import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { tryAiIntentRouter } from "@/lib/assistant/ai-intent-router/router";
import { resetRateLimitStateForTests } from "@/lib/assistant/ai-intent-router/rate-limit";

vi.mock("@/lib/security/env", () => ({
  getAiIntentRouterConfig: vi.fn(),
}));

vi.mock("@/lib/assistant/ai-intent-router/feature-flag", () => ({
  isAiIntentRouterEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/assistant/ai-intent-router/providers", () => ({
  createIntentRouterProvider: vi.fn(),
}));

vi.mock("@/lib/data/ai-intent-router", () => ({
  getDailyUsageCount: vi.fn(async () => 0),
  incrementDailyUsage: vi.fn(async () => undefined),
  logAiIntentRouterTelemetry: vi.fn(async () => undefined),
  getLastSafeProviderError: vi.fn(async () => null),
}));

import { getAiIntentRouterConfig } from "@/lib/security/env";
import { isAiIntentRouterEnabled } from "@/lib/assistant/ai-intent-router/feature-flag";
import { createIntentRouterProvider } from "@/lib/assistant/ai-intent-router/providers";
import { getDailyUsageCount } from "@/lib/data/ai-intent-router";

const config = {
  provider: "cloudflare" as const,
  accountId: "acct",
  apiToken: "token",
  model: "@cf/meta/llama-3.1-8b-instruct",
  dailyCap: 50,
  timeoutMs: 8000,
  minConfidence: 0.7,
};

describe("tryAiIntentRouter", () => {
  beforeEach(() => {
    resetRateLimitStateForTests();
    vi.mocked(getAiIntentRouterConfig).mockReturnValue(config);
    vi.mocked(isAiIntentRouterEnabled).mockReturnValue(true);
    vi.mocked(getDailyUsageCount).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("skips when disabled", async () => {
    vi.mocked(isAiIntentRouterEnabled).mockReturnValue(false);
    const result = await tryAiIntentRouter({
      message: "show my week",
      userId: "user-1",
    });
    expect(result.attempted).toBe(false);
    if (!result.attempted) {
      expect(result.reason).toBe("disabled");
    }
  });

  it("skips when misconfigured", async () => {
    vi.mocked(getAiIntentRouterConfig).mockReturnValue(null);
    const result = await tryAiIntentRouter({
      message: "show my week",
      userId: "user-1",
    });
    expect(result.attempted).toBe(false);
    if (!result.attempted) {
      expect(result.reason).toBe("misconfigured");
    }
  });

  it("maps valid provider output to command", async () => {
    vi.mocked(createIntentRouterProvider).mockReturnValue({
      classify: vi.fn(async () => ({
        schemaVersion: 1 as const,
        status: "matched" as const,
        intent: "show_next_class",
        confidence: 0.95,
        range: null,
        entities: {},
        clarificationQuestion: null,
      })),
    });

    const result = await tryAiIntentRouter({
      message: "when is my next lecture",
      userId: "user-1",
      parseOptions: {
        now: new Date("2026-07-12T12:00:00-05:00"),
        timezone: "America/Chicago",
      },
    });

    expect(result.attempted).toBe(true);
    if (result.attempted) {
      expect(result.parseResult.kind).toBe("command");
      if (result.parseResult.kind === "command") {
        expect(result.parseResult.command.intent).toBe("show_next_class");
      }
    }
  });

  it("returns not attempted on schema invalid output", async () => {
    vi.mocked(createIntentRouterProvider).mockReturnValue({
      classify: vi.fn(async () => ({
        schemaVersion: 1 as const,
        status: "matched" as const,
        intent: "not_a_real_intent",
        confidence: 0.95,
        range: null,
        entities: {},
        clarificationQuestion: null,
      })),
    });

    const result = await tryAiIntentRouter({
      message: "do something weird",
      userId: "user-1",
    });
    expect(result.attempted).toBe(false);
    if (!result.attempted) {
      expect(result.reason).toBe("schema_invalid");
    }
  });

  it("respects daily cap", async () => {
    vi.mocked(getDailyUsageCount).mockResolvedValue(50);
    const result = await tryAiIntentRouter({
      message: "show next week",
      userId: "user-1",
    });
    expect(result.attempted).toBe(false);
    if (!result.attempted) {
      expect(result.reason).toBe("daily_cap");
    }
  });
});
