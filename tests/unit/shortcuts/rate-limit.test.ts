import { describe, expect, it, beforeEach } from "vitest";
import {
  checkFailedAuthRateLimit,
  checkShortcutDeviceRateLimit,
  checkShortcutIpRateLimit,
  resetRateLimitState,
} from "@/lib/shortcuts/rate-limit";

describe("shortcut rate limiting", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it("allows requests under the device limit", () => {
    expect(checkShortcutDeviceRateLimit("device-1")).toBe(true);
    expect(checkShortcutDeviceRateLimit("device-1")).toBe(true);
  });

  it("blocks excessive failed auth attempts", () => {
    for (let index = 0; index < 10; index += 1) {
      expect(checkFailedAuthRateLimit("1.2.3.4")).toBe(true);
    }
    expect(checkFailedAuthRateLimit("1.2.3.4")).toBe(false);
  });

  it("tracks ip limits separately from device limits", () => {
    expect(checkShortcutIpRateLimit("1.2.3.4")).toBe(true);
    expect(checkShortcutDeviceRateLimit("device-2")).toBe(true);
  });
});
