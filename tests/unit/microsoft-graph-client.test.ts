import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphApiError, syncGraphCalendarDelta } from "@/lib/integrations/microsoft/graph-client";

describe("microsoft graph client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("honors Retry-After on HTTP 429", async () => {
    let attempts = 0;
    global.fetch = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(JSON.stringify({ error: { message: "throttled" } }), {
          status: 429,
          headers: { "Retry-After": "0" },
        });
      }

      return new Response(
        JSON.stringify({
          value: [],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?token=1",
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await syncGraphCalendarDelta({
      accessToken: "token",
      externalCalendarId: "cal-1",
      deltaUrl: null,
      windowStart: "2026-06-01T00:00:00.000Z",
      windowEnd: "2026-12-01T00:00:00.000Z",
    });

    expect(result.deltaLink).toContain("delta");
    expect(attempts).toBe(2);
  });

  it("surfaces 410 as delta reset requirement", async () => {
    global.fetch = vi.fn(async () =>
      new Response("", { status: 410 }),
    ) as typeof fetch;

    await expect(
      syncGraphCalendarDelta({
        accessToken: "token",
        externalCalendarId: "cal-1",
        deltaUrl: "https://graph.microsoft.com/v1.0/delta?token=stale",
        windowStart: "2026-06-01T00:00:00.000Z",
        windowEnd: "2026-12-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ requiresDeltaReset: true } satisfies Partial<GraphApiError>);
  });

  it("detects repeated nextLink pagination loops", async () => {
    const loopUrl = "https://graph.microsoft.com/v1.0/delta?next=1";
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          value: [],
          "@odata.nextLink": loopUrl,
        }),
        { status: 200 },
      ),
    ) as typeof fetch;

    await expect(
      syncGraphCalendarDelta({
        accessToken: "token",
        externalCalendarId: "cal-1",
        deltaUrl: loopUrl,
        windowStart: "2026-06-01T00:00:00.000Z",
        windowEnd: "2026-12-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("pagination loop");
  });
});
