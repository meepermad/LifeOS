import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDailyDedupKey,
  processScheduledNotifications,
} from "@/lib/notifications/scheduling";

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
  isDeliveryComplete: (status: string) =>
    status === "sent" || status === "partial",
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

const basePreferences = {
  notifications_enabled: true,
  notification_privacy_mode: "private",
  daily_notifications_enabled: true,
  weekly_notifications_enabled: false,
  deadline_notifications_enabled: false,
  overload_notifications_enabled: false,
  morning_review_enabled: false,
  evening_review_enabled: false,
  weekly_review_reminder_enabled: false,
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

describe("daily agenda scheduling timezone + dedup", () => {
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
    mocks.calculateWorkloadWithEventCount.mockResolvedValue({
      summary: {
        periodStart: "2026-07-14T05:00:00.000Z",
        periodEnd: "2026-07-15T04:59:59.000Z",
        status: "manageable",
        requiredTaskMinutes: 60,
        availableFocusMinutes: 120,
        unallocatedTaskMinutes: 0,
        allocatedTaskMinutes: 60,
        fixedMinutes: 0,
        unestimatedTaskCount: 0,
        highestPressureDays: [],
      },
      fixedEventCount: 2,
    });
    mocks.listWaitingFollowupsDue.mockResolvedValue([]);
  });

  it("resolves 1:00 PM Chicago to 18:00 UTC in scheduled_for", async () => {
    const now = new Date("2026-07-14T18:15:00.000Z");
    await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );

    expect(mocks.sendNotificationToUser).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        notificationType: "daily_agenda",
        scheduledFor: "2026-07-14T18:00:00.000Z",
        deduplicationKey: buildDailyDedupKey("user-1", "2026-07-14"),
      }),
    );
  });

  it("does not consider 1:00 PM due at 11:08 AM Chicago", async () => {
    const now = new Date("2026-07-14T16:08:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );

    expect(mocks.sendNotificationToUser).not.toHaveBeenCalled();
    expect(mocks.findDeliveryByKey).not.toHaveBeenCalled();
    expect(result.notDue).toBeGreaterThan(0);
    expect(result.daily).toBe(0);
    expect(result.stale).toBe(0);
  });

  it("is eligible at 1:15 PM Chicago", async () => {
    const now = new Date("2026-07-14T18:15:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );
    expect(result.daily).toBe(1);
    expect(result.sent).toBe(1);
  });

  it("is eligible at exact scheduled time", async () => {
    const now = new Date("2026-07-14T18:00:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );
    expect(result.daily).toBe(1);
  });

  it("is stale well after the grace window", async () => {
    const now = new Date("2026-07-14T18:45:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );
    expect(mocks.sendNotificationToUser).not.toHaveBeenCalled();
    expect(result.stale).toBeGreaterThan(0);
    expect(result.daily).toBe(0);
  });

  it("does not create a delivery row when not due", async () => {
    const now = new Date("2026-07-14T16:08:00.000Z");
    await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );
    expect(mocks.findDeliveryByKey).not.toHaveBeenCalled();
    expect(mocks.sendNotificationToUser).not.toHaveBeenCalled();
  });

  it("premature skipped row does not block later valid delivery", async () => {
    mocks.findDeliveryByKey.mockResolvedValue({
      id: "d1",
      deduplicationKey: buildDailyDedupKey("user-1", "2026-07-14"),
      status: "skipped",
    });
    mocks.suppressesDuplicateDelivery.mockReturnValue(false);

    const now = new Date("2026-07-14T18:15:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );

    expect(mocks.sendNotificationToUser).toHaveBeenCalled();
    expect(result.daily).toBe(1);
  });

  it("sent delivery suppresses duplicates", async () => {
    mocks.findDeliveryByKey.mockResolvedValue({
      id: "d1",
      deduplicationKey: buildDailyDedupKey("user-1", "2026-07-14"),
      status: "sent",
    });
    mocks.suppressesDuplicateDelivery.mockImplementation(
      (status: string) =>
        status === "pending" ||
        status === "sending" ||
        status === "sent" ||
        status === "partial",
    );

    const now = new Date("2026-07-14T18:15:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );

    expect(mocks.sendNotificationToUser).not.toHaveBeenCalled();
    expect(result.deduplicated).toBeGreaterThan(0);
  });

  it("changed notification time before send is not blocked by obsolete skip", async () => {
    // Preference changed to 13:00; obsolete skip from earlier mis-evaluation exists.
    mocks.findDeliveryByKey.mockResolvedValue({
      id: "poison",
      deduplicationKey: buildDailyDedupKey("user-1", "2026-07-14"),
      status: "skipped",
    });
    mocks.suppressesDuplicateDelivery.mockReturnValue(false);

    const now = new Date("2026-07-14T18:10:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      { ...basePreferences, daily_notification_time: "13:00:00" } as never,
      0,
      now,
      "America/Chicago",
    );

    expect(result.daily).toBe(1);
    expect(mocks.sendNotificationToUser).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ scheduledFor: "2026-07-14T18:00:00.000Z" }),
    );
  });

  it("reports no-subscription separately", async () => {
    mocks.sendNotificationToUser.mockResolvedValue({
      successCount: 0,
      subscriptionCount: 0,
      failureCount: 0,
      invalidCount: 0,
    });
    const now = new Date("2026-07-14T18:05:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
      "America/Chicago",
    );
    expect(result.noSubscription).toBe(1);
    expect(result.daily).toBe(0);
  });

  it("tomorrow is independent of today's occurrence", async () => {
    mocks.findDeliveryByKey.mockImplementation(async (_c, key: string) => {
      if (key.includes("2026-07-14")) {
        return { id: "d1", deduplicationKey: key, status: "sent" };
      }
      return null;
    });
    mocks.suppressesDuplicateDelivery.mockImplementation(
      (status: string) => status === "sent",
    );

    const tomorrowDue = new Date("2026-07-15T18:05:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      tomorrowDue,
      "America/Chicago",
    );
    expect(result.daily).toBe(1);
  });
});
