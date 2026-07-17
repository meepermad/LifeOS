import { describe, expect, it } from "vitest";
import {
  buildDailyAgendaPayload,
  buildFallbackPayload,
  buildTestPayload,
  serializePayload,
} from "@/lib/notifications/payloads";
import {
  isAllowedNotificationRoute,
  sanitizeNotificationUrl,
} from "@/lib/notifications/privacy";
import type { WorkloadSummary } from "@/lib/planning/types";

const baseSummary: WorkloadSummary = {
  periodType: "day",
  periodStart: "2026-07-11T05:00:00.000Z",
  periodEnd: "2026-07-12T04:59:59.000Z",
  fixedMinutes: 120,
  rawOpenMinutes: 480,
  reservedBufferMinutes: 96,
  availableFocusMinutes: 384,
  requiredTaskMinutes: 180,
  allocatedTaskMinutes: 150,
  unallocatedTaskMinutes: 30,
  scheduledFocusMinutes: 0,
  unestimatedTaskCount: 1,
  overdueTaskCount: 0,
  capacityRatio: 0.39,
  status: "heavy",
  hasIncompleteData: false,
  needsAvailabilityConfiguration: false,
  daySummaries: [],
  allocation: {
    perDayAllocations: [],
    allocatedTaskMinutes: 150,
    unallocatedTaskMinutes: 30,
    tasksAtRisk: [],
    tasksImpossibleBeforeDeadline: [],
    taskEntries: [],
  },
  tentativeEventIds: [],
  unestimatedTaskIds: ["task-1"],
  highestPressureDays: ["2026-07-11"],
  explanation: [],
};

describe("notification payloads", () => {
  it("private mode contains no sensitive details", () => {
    const payload = buildDailyAgendaPayload(baseSummary, "private", 4);
    expect(payload.body).not.toMatch(/task-1/i);
    expect(payload.body).not.toMatch(/canvas/i);
    expect(payload.title).toBe("LifeOS daily plan");
  });

  it("detailed mode contains allowed summary data only", () => {
    const payload = buildDailyAgendaPayload(baseSummary, "detailed", 4);
    expect(payload.body).toContain("4 events");
    expect(payload.body).toContain("focus");
    expect(payload.body).not.toContain("task-1");
  });

  it("rejects external destination URLs", () => {
    expect(isAllowedNotificationRoute("https://evil.com")).toBe(false);
    expect(sanitizeNotificationUrl("https://evil.com")).toBe("/today");
  });

  it("accepts same-origin relative routes", () => {
    expect(isAllowedNotificationRoute("/week")).toBe(true);
    expect(sanitizeNotificationUrl("/week")).toBe("/week");
  });

  it("malformed serialized payload uses safe fallback fields in test payload", () => {
    const test = buildTestPayload();
    expect(test.url).toBe("/settings/notifications");
    expect(test.destination).toEqual({ kind: "notification_settings" });
    const fallback = buildFallbackPayload();
    expect(fallback.url).toBe("/today");
    const serialized = serializePayload(test);
    const parsed = JSON.parse(serialized);
    expect(parsed.url).toBe("/settings/notifications");
    expect(parsed.version).toBe(1);
    expect(parsed.destination.kind).toBe("notification_settings");
  });
});
