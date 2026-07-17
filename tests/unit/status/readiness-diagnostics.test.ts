import { describe, expect, it } from "vitest";
import {
  buildSemesterReadinessChecks,
  type SystemStatusSnapshot,
} from "@/lib/status/system-status";

function baseStatus(
  overrides: Partial<SystemStatusSnapshot> = {},
): SystemStatusSnapshot {
  return {
    appVersion: "test",
    canvasConnected: true,
    canvasLastSuccessAt: new Date().toISOString(),
    pushPermissionHint: "devices-present",
    devicePushCount: 1,
    lastNotificationEvidenceAt: null,
    recurringTemplatesActive: 1,
    recurringNeedingGeneration: 0,
    activeTermName: "Fall",
    activeTermCurrent: true,
    courseCount: 2,
    unassignedWorkShifts: 0,
    workProfilesConfigured: 1,
    upcomingWorkShifts: 2,
    staleTimerOpen: false,
    pendingReviews: 0,
    inboxCount: 0,
    ...overrides,
  };
}

describe("semester readiness diagnostics", () => {
  it("marks healthy setup as ok with diagnostic fields", () => {
    const checks = buildSemesterReadinessChecks(baseStatus());
    expect(checks.every((check) => check.ok)).toBe(true);
    expect(checks[0]?.why.length).toBeGreaterThan(10);
    expect(checks[0]?.howToFix.length).toBeGreaterThan(10);
    expect(checks[0]?.estimatedMinutes).toBeGreaterThan(0);
  });

  it("flags missing courses and stale recurrence", () => {
    const checks = buildSemesterReadinessChecks(
      baseStatus({
        courseCount: 0,
        recurringNeedingGeneration: 2,
      }),
    );
    const courses = checks.find((check) => check.id === "courses");
    const recurrence = checks.find((check) => check.id === "recurrence");
    expect(courses?.ok).toBe(false);
    expect(courses?.severity).toBe("error");
    expect(recurrence?.ok).toBe(false);
    expect(recurrence?.href).toBe("/tasks/recurring");
  });
});
