import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLocalDateKeyInTimezone,
  getLocalWeekdayInTimezone,
  getWeekStartKeyInTimezone,
  resolveLocalNotificationInstant,
} from "@/lib/dates/timezone";
import { processScheduledNotifications } from "@/lib/notifications/scheduling";

const mocks = vi.hoisted(() => ({
  findDeliveryByKey: vi.fn(),
  suppressesDuplicateDelivery: vi.fn(),
  sendNotificationToUser: vi.fn(),
  calculateWorkloadWithEventCount: vi.fn(),
  fetchDeadlineTasks: vi.fn(),
  hasCompletedReviewSession: vi.fn(),
  listWaitingFollowupsDue: vi.fn(),
  countOverdueNeedingDecision: vi.fn(),
  countAwaitingPlanningFeedback: vi.fn(),
}));

vi.mock("@/lib/notifications/delivery", () => ({
  findDeliveryByKey: mocks.findDeliveryByKey,
  suppressesDuplicateDelivery: mocks.suppressesDuplicateDelivery,
  isDeliveryComplete: () => false,
  markDeliverySkipped: vi.fn(),
}));

vi.mock("@/lib/notifications/sender", () => ({
  sendNotificationToUser: mocks.sendNotificationToUser,
}));

vi.mock("@/lib/notifications/workload-admin", () => ({
  calculateWorkloadWithEventCount: mocks.calculateWorkloadWithEventCount,
  fetchDeadlineTasks: mocks.fetchDeadlineTasks,
}));

vi.mock("@/lib/notifications/workflow-queries", () => ({
  hasCompletedReviewSession: mocks.hasCompletedReviewSession,
  listWaitingFollowupsDue: mocks.listWaitingFollowupsDue,
  countOverdueNeedingDecision: mocks.countOverdueNeedingDecision,
  countAwaitingPlanningFeedback: mocks.countAwaitingPlanningFeedback,
}));

const client = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        is: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
} as never;

const reviewPreferences = {
  notifications_enabled: true,
  notification_privacy_mode: "private",
  daily_notifications_enabled: false,
  weekly_notifications_enabled: false,
  deadline_notifications_enabled: false,
  overload_notifications_enabled: false,
  morning_review_enabled: true,
  morning_review_time: "07:00",
  evening_review_enabled: true,
  evening_review_time: "20:00",
  weekly_review_reminder_enabled: true,
  waiting_followup_enabled: false,
  overdue_decision_reminder_enabled: false,
  planning_feedback_reminder_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  stale_timer_threshold_hours: 4,
  stale_timer_notified_at: null,
  weekly_notification_day: 0,
  weekly_notification_time: "09:00",
  deadline_warning_hours: 24,
  daily_notification_time: "13:00:00",
};

describe("review notification local timezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findDeliveryByKey.mockResolvedValue(null);
    mocks.suppressesDuplicateDelivery.mockReturnValue(false);
    mocks.sendNotificationToUser.mockResolvedValue({
      successCount: 1,
      subscriptionCount: 1,
      failureCount: 0,
      invalidCount: 0,
    });
    mocks.hasCompletedReviewSession.mockResolvedValue(false);
    mocks.listWaitingFollowupsDue.mockResolvedValue([]);
  });

  it("maps morning 07:00 Chicago to 12:00 UTC in July", () => {
    expect(
      resolveLocalNotificationInstant({
        localDate: "2026-07-14",
        localTime: "07:00:00",
        timezone: "America/Chicago",
      }).toISOString(),
    ).toBe("2026-07-14T12:00:00.000Z");
  });

  it("maps evening 20:00 Chicago to 01:00 UTC next day in July", () => {
    expect(
      resolveLocalNotificationInstant({
        localDate: "2026-07-14",
        localTime: "20:00:00",
        timezone: "America/Chicago",
      }).toISOString(),
    ).toBe("2026-07-15T01:00:00.000Z");
  });

  it("uses the user local date when UTC date differs", () => {
    // 2026-07-15T02:00Z = 2026-07-14 21:00 Chicago
    const now = new Date("2026-07-15T02:00:00.000Z");
    expect(getLocalDateKeyInTimezone(now, "America/Chicago")).toBe(
      "2026-07-14",
    );
    expect(getLocalDateKeyInTimezone(now, "UTC")).toBe("2026-07-15");
  });

  it("uses local weekday for weekly boundaries (Sunday/Monday)", () => {
    // Sunday 2026-07-12 10:00 Chicago = 15:00 UTC
    const sunday = new Date("2026-07-12T15:00:00.000Z");
    expect(getLocalWeekdayInTimezone(sunday, "America/Chicago")).toBe(0);
    expect(
      getWeekStartKeyInTimezone("2026-07-12", 0, "America/Chicago"),
    ).toBe("2026-07-12");
    expect(
      getWeekStartKeyInTimezone("2026-07-13", 1, "America/Chicago"),
    ).toBe("2026-07-13");
    // Sunday with Monday week start → previous Monday
    expect(
      getWeekStartKeyInTimezone("2026-07-12", 1, "America/Chicago"),
    ).toBe("2026-07-06");
  });

  it("sends morning review on the local date key", async () => {
    const now = new Date("2026-07-14T12:05:00.000Z"); // 07:05 Chicago
    const result = await processScheduledNotifications(
      client,
      "user-1",
      reviewPreferences as never,
      0,
      now,
      "America/Chicago",
    );

    expect(mocks.hasCompletedReviewSession).toHaveBeenCalledWith(
      client,
      "user-1",
      "morning_daily",
      { dateKey: "2026-07-14" },
    );
    expect(mocks.sendNotificationToUser).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        notificationType: "morning_review",
        scheduledFor: "2026-07-14T12:00:00.000Z",
      }),
    );
    expect(result.morningReview).toBe(1);
  });

  it("sends evening review with resolved local instant", async () => {
    const prefs = {
      ...reviewPreferences,
      morning_review_enabled: false,
      weekly_review_reminder_enabled: false,
    };
    const now = new Date("2026-07-15T01:05:00.000Z"); // 20:05 Chicago on Jul 14
    const result = await processScheduledNotifications(
      client,
      "user-1",
      prefs as never,
      0,
      now,
      "America/Chicago",
    );

    expect(mocks.sendNotificationToUser).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        notificationType: "evening_review",
        scheduledFor: "2026-07-15T01:00:00.000Z",
        deduplicationKey: "evening_review:user-1:2026-07-14",
      }),
    );
    expect(result.eveningReview).toBe(1);
  });

  it("sends weekly review on the local Sunday weekday", async () => {
    const prefs = {
      ...reviewPreferences,
      morning_review_enabled: false,
      evening_review_enabled: false,
      weekly_notification_day: 0,
      weekly_notification_time: "09:00",
    };
    // Sunday 2026-07-12 09:05 Chicago = 14:05 UTC
    const now = new Date("2026-07-12T14:05:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      prefs as never,
      0,
      now,
      "America/Chicago",
    );

    expect(mocks.sendNotificationToUser).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        notificationType: "weekly_review",
        scheduledFor: "2026-07-12T14:00:00.000Z",
      }),
    );
    expect(result.weeklyReview).toBe(1);
  });
});
