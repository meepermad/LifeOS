import { describe, expect, it } from "vitest";
import { normalizeDeferredStatus } from "@/lib/tasks/triage";

describe("normalizeDeferredStatus", () => {
  it("reopens deferred tasks whose defer window has passed", () => {
    const result = normalizeDeferredStatus(
      {
        status: "deferred" as const,
        deferred_until_at: "2026-07-01T00:00:00.000Z",
      },
      new Date("2026-07-14T12:00:00.000Z"),
    );

    expect(result.status).toBe("open");
  });

  it("leaves future-deferred tasks unchanged", () => {
    const result = normalizeDeferredStatus(
      {
        status: "deferred" as const,
        deferred_until_at: "2026-07-20T00:00:00.000Z",
      },
      new Date("2026-07-14T12:00:00.000Z"),
    );

    expect(result.status).toBe("deferred");
  });
});
