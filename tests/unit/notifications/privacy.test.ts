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
    expect(isAllowedNotificationRoute("/admin")).toBe(false);
    expect(sanitizeNotificationUrl("/admin?next=/today")).toBe("/today");
  });

  it("accepts approved internal routes including review and calendar", () => {
    for (const route of [
      "/today",
      "/week",
      "/tasks",
      "/settings",
      "/review/daily",
      "/review/weekly",
      "/calendar",
    ] as const) {
      expect(isAllowedNotificationRoute(route)).toBe(true);
      expect(sanitizeNotificationUrl(route)).toBe(route);
    }
    expect(
      sanitizeNotificationUrl("/review/daily?period=evening"),
    ).toBe("/review/daily?period=evening");
  });
});
