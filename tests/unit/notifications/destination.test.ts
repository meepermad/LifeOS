import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  destinationForNotificationType,
  resolveNotificationDestination,
  resolvePathFromPushData,
  sanitizeInternalReturnPath,
  type NotificationDestination,
} from "@/lib/notifications/destination";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const BLOCK_ID = "22222222-2222-4222-8222-222222222222";
const ENTRY_ID = "33333333-3333-4333-8333-333333333333";

describe("resolveNotificationDestination", () => {
  it("maps daily agenda to /today", () => {
    expect(resolveNotificationDestination({ kind: "today" })).toBe("/today");
  });

  it("maps weekly summary to calendar week", () => {
    expect(resolveNotificationDestination({ kind: "calendar_week" })).toBe(
      "/calendar?view=week",
    );
    expect(
      resolveNotificationDestination({
        kind: "calendar_week",
        localDate: "2026-07-16",
      }),
    ).toBe("/calendar?view=week&date=2026-07-16");
  });

  it("maps deadline and overdue tasks", () => {
    expect(
      resolveNotificationDestination({
        kind: "task",
        taskId: TASK_ID,
        view: "upcoming",
      }),
    ).toBe(`/tasks?view=upcoming&focus=${TASK_ID}`);
    expect(
      resolveNotificationDestination({
        kind: "task",
        taskId: TASK_ID,
        view: "overdue",
      }),
    ).toBe(`/tasks?view=overdue&focus=${TASK_ID}`);
  });

  it("maps morning and evening reviews", () => {
    expect(
      resolveNotificationDestination({
        kind: "daily_review",
        period: "morning",
      }),
    ).toBe("/review/daily?period=morning");
    expect(
      resolveNotificationDestination({
        kind: "daily_review",
        period: "evening",
      }),
    ).toBe("/review/daily?period=evening");
  });

  it("maps weekly review and capacity", () => {
    expect(resolveNotificationDestination({ kind: "weekly_review" })).toBe(
      "/review/weekly",
    );
    expect(
      resolveNotificationDestination({
        kind: "weekly_review",
        step: "capacity",
      }),
    ).toBe("/review/weekly?step=capacity");
  });

  it("maps waiting follow-up", () => {
    expect(
      resolveNotificationDestination({
        kind: "task",
        taskId: TASK_ID,
        view: "waiting",
      }),
    ).toBe(`/tasks?view=waiting&focus=${TASK_ID}`);
  });

  it("maps planning feedback", () => {
    expect(
      resolveNotificationDestination({
        kind: "planning_feedback",
        planningBlockId: BLOCK_ID,
      }),
    ).toBe(
      `/review/daily?period=evening&step=planning-feedback&focus=${BLOCK_ID}`,
    );
    expect(
      resolveNotificationDestination({ kind: "planning_feedback" }),
    ).toBe("/review/daily?period=evening&step=planning-feedback");
  });

  it("maps stale timer and test", () => {
    expect(
      resolveNotificationDestination({
        kind: "active_timer",
        timeEntryId: ENTRY_ID,
      }),
    ).toBe(`/today?panel=active-timer&entry=${ENTRY_ID}`);
    expect(
      resolveNotificationDestination({ kind: "notification_settings" }),
    ).toBe("/settings/notifications");
  });

  it("falls back for unknown and malformed destinations", () => {
    expect(
      resolveNotificationDestination({
        kind: "unknown",
      } as unknown as NotificationDestination),
    ).toBe("/today");
    expect(resolveNotificationDestination(null)).toBe("/today");
    expect(resolveNotificationDestination(undefined)).toBe("/today");
    expect(
      resolveNotificationDestination({
        kind: "task",
        taskId: "not-a-uuid",
        view: "waiting",
      }),
    ).toBe("/today");
    expect(
      resolveNotificationDestination({
        kind: "daily_review",
        period: "noon" as "morning",
      }),
    ).toBe("/today");
    expect(
      resolveNotificationDestination({
        kind: "calendar_week",
        localDate: "2026-13-40",
      }),
    ).toBe("/today");
  });

  it("destinationForNotificationType covers producers", () => {
    expect(destinationForNotificationType("daily_agenda").kind).toBe("today");
    expect(destinationForNotificationType("weekly_summary").kind).toBe(
      "calendar_week",
    );
    expect(destinationForNotificationType("overload_warning")).toEqual({
      kind: "weekly_review",
      step: "capacity",
    });
    expect(destinationForNotificationType("test").kind).toBe(
      "notification_settings",
    );
  });
});

describe("sanitizeInternalReturnPath security", () => {
  it("rejects external and dangerous URLs", () => {
    expect(sanitizeInternalReturnPath("https://evil.example")).toBe("/today");
    expect(sanitizeInternalReturnPath("//evil.example")).toBe("/today");
    expect(sanitizeInternalReturnPath("javascript:alert(1)")).toBe("/today");
    expect(sanitizeInternalReturnPath("data:text/html,hi")).toBe("/today");
    expect(sanitizeInternalReturnPath("\\\\evil.example")).toBe("/today");
    expect(sanitizeInternalReturnPath("/%5c%5cevil.example")).toBe("/today");
  });

  it("rejects oversized and unknown prefixes", () => {
    expect(sanitizeInternalReturnPath(`/${"a".repeat(600)}`)).toBe("/today");
    expect(sanitizeInternalReturnPath("/admin/secret")).toBe("/today");
  });

  it("accepts known LifeOS paths with safe queries", () => {
    expect(
      sanitizeInternalReturnPath("/tasks?view=waiting&focus=" + TASK_ID),
    ).toBe(`/tasks?view=waiting&focus=${TASK_ID}`);
    expect(
      sanitizeInternalReturnPath("/review/daily?period=evening"),
    ).toBe("/review/daily?period=evening");
  });
});

describe("legacy push payload resolution", () => {
  it("maps legacy test/settings urls and falls back otherwise", () => {
    expect(resolvePathFromPushData({ url: "/settings" })).toBe(
      "/settings/notifications",
    );
    expect(resolvePathFromPushData({ url: "/test" })).toBe(
      "/settings/notifications",
    );
    expect(resolvePathFromPushData({ url: "/today" })).toBe("/today");
    expect(resolvePathFromPushData({ url: "/review/daily?mode=evening" })).toBe(
      "/review/daily?mode=evening",
    );
    expect(resolvePathFromPushData({})).toBe("/today");
    expect(resolvePathFromPushData(null)).toBe("/today");
  });

  it("prefers typed destination over url", () => {
    expect(
      resolvePathFromPushData({
        version: 1,
        destination: { kind: "daily_review", period: "morning" },
        url: "/today",
      }),
    ).toBe("/review/daily?period=morning");
  });
});

describe("service-worker destination mirror parity", () => {
  it("matches TypeScript resolver outputs", () => {
    const script = readFileSync(
      resolve(process.cwd(), "public/lifeos-notification-destinations.js"),
      "utf8",
    );
    const sandbox: {
      LifeOsNotificationDestinations?: {
        resolveNotificationDestination: (
          d: NotificationDestination,
        ) => string;
        sanitizeInternalReturnPath: (p: string) => string;
        resolvePathFromPushData: (d: Record<string, unknown>) => string;
      };
    } = {};
    // eslint-disable-next-line no-new-func -- load SW mirror for parity
    new Function("self", script)(sandbox);
    const sw = sandbox.LifeOsNotificationDestinations!;

    const cases: NotificationDestination[] = [
      { kind: "today" },
      { kind: "calendar_week" },
      { kind: "calendar_week", localDate: "2026-07-16" },
      { kind: "daily_review", period: "morning" },
      { kind: "daily_review", period: "evening", step: "feedback" },
      { kind: "weekly_review", step: "capacity" },
      { kind: "task", taskId: TASK_ID, view: "waiting" },
      { kind: "planning_feedback", planningBlockId: BLOCK_ID },
      { kind: "active_timer", timeEntryId: ENTRY_ID },
      { kind: "notification_settings" },
    ];

    for (const dest of cases) {
      expect(sw.resolveNotificationDestination(dest)).toBe(
        resolveNotificationDestination(dest),
      );
    }

    expect(sw.sanitizeInternalReturnPath("//evil")).toBe(
      sanitizeInternalReturnPath("//evil"),
    );
    expect(sw.resolvePathFromPushData({ url: "/settings" })).toBe(
      resolvePathFromPushData({ url: "/settings" }),
    );
  });
});
