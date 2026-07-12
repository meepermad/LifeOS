import { describe, expect, it } from "vitest";
import {
  inferDeviceName,
  toDeviceSummary,
} from "@/lib/notifications/subscriptions";
import type { PushSubscriptionRow } from "@/types/domain";

describe("subscriptions helpers", () => {
  it("infers iPhone PWA label", () => {
    expect(
      inferDeviceName(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        true,
      ),
    ).toBe("iPhone PWA");
  });

  it("infers desktop browser label", () => {
    expect(
      inferDeviceName(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
        false,
      ),
    ).toBe("Desktop browser");
  });

  it("safe device response omits endpoint and keys", () => {
    const row: PushSubscriptionRow = {
      id: "sub-1",
      user_id: "user-1",
      endpoint: "https://push.example.com/secret-endpoint",
      p256dh: "secret-p256dh",
      auth: "secret-auth",
      device_name: "Desktop browser",
      user_agent: "test",
      content_encoding: null,
      is_active: true,
      last_successful_push: null,
      last_failed_push: null,
      failure_count: 0,
      created_at: "2026-07-11T00:00:00Z",
      updated_at: "2026-07-11T00:00:00Z",
    };

    const summary = toDeviceSummary(row);
    expect(summary.id).toBe("sub-1");
    expect(summary.deviceName).toBe("Desktop browser");
    expect(summary).not.toHaveProperty("endpoint");
    expect(summary).not.toHaveProperty("p256dh");
    expect(summary).not.toHaveProperty("auth");
  });
});
