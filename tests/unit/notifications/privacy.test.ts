import { describe, expect, it } from "vitest";
import {
  isAllowedNotificationRoute,
  sanitizeNotificationUrl,
} from "@/lib/notifications/privacy";

describe("notification destination privacy", () => {
  it("rejects protocol-relative and absolute external URLs", () => {
    expect(isAllowedNotificationRoute("//evil.com")).toBe(false);
    expect(isAllowedNotificationRoute("https://evil.com/phish")).toBe(false);
    expect(sanitizeNotificationUrl("//evil.com")).toBe("/today");
    expect(sanitizeNotificationUrl("javascript:alert(1)")).toBe("/today");
  });

  it("rejects internal routes outside the allowlist", () => {
    expect(isAllowedNotificationRoute("/imports")).toBe(false);
    expect(sanitizeNotificationUrl("/imports?next=/today")).toBe("/today");
  });

  it("accepts only approved internal routes", () => {
    for (const route of ["/today", "/week", "/tasks", "/settings"] as const) {
      expect(isAllowedNotificationRoute(route)).toBe(true);
      expect(sanitizeNotificationUrl(route)).toBe(route);
    }
  });
});
