import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CloudflareIntentRouterProvider } from "@/lib/assistant/ai-intent-router/providers/cloudflare";

describe("CloudflareIntentRouterProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const input = {
    message: "what does next week look like",
    currentDate: "2026-07-12",
    timezone: "America/Chicago",
    allowedIntents: ["schedule_summary"],
    allowedRangeKinds: ["calendar_week"],
  };

  it("parses valid JSON response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            response: JSON.stringify({
              schemaVersion: 1,
              status: "matched",
              intent: "schedule_summary",
              confidence: 0.9,
              range: { kind: "calendar_week", offset: 1 },
              entities: {},
              clarificationQuestion: null,
            }),
          },
        }),
        { status: 200 },
      ),
    );

    const provider = new CloudflareIntentRouterProvider("acct", "token", "model");
    const result = await provider.classify(input, new AbortController().signal);
    expect(result.intent).toBe("schedule_summary");
  });

  it("throws on 429", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 429 }));
    const provider = new CloudflareIntentRouterProvider("acct", "token", "model");
    await expect(
      provider.classify(input, new AbortController().signal),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("throws on 500", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 500 }));
    const provider = new CloudflareIntentRouterProvider("acct", "token", "model");
    await expect(
      provider.classify(input, new AbortController().signal),
    ).rejects.toMatchObject({ code: "provider_error" });
  });
});
