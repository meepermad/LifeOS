import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBrowserPushSupport } from "@/lib/notifications/browser-support";

describe("detectBrowserPushSupport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports insecure context with helpful reason", () => {
    vi.stubGlobal("window", { isSecureContext: false });
    vi.stubGlobal("navigator", { serviceWorker: {} });

    const result = detectBrowserPushSupport();
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("secure context");
  });
});
