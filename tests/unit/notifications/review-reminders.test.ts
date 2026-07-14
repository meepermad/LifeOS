import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildEveningReviewDedupKey,
  buildMorningReviewDedupKey,
  buildOverdueDecisionDedupKey,
  buildPlanningFeedbackDedupKey,
  buildWaitingFollowupDedupKey,
  buildWeeklyReviewDedupKey,
  isScheduledTimeInWindow,
  processScheduledNotifications,
} from "@/lib/notifications/scheduling";

const mocks = vi.hoisted(() => ({
  findDeliveryByKey: vi.fn(),
  isDeliveryComplete: vi.fn(),
  markDeliverySkipped: vi.fn(),
  sendNotificationToUser: vi.fn(),
  calculateWorkloadWithEventCount: vi.fn(),
  fetchDeadlineTasks: vi.fn(),
  hasCompletedReviewSession: vi.fn(),
  countWaitingFollowupsDue: vi.fn(),
  listWaitingFollowupsDue: vi.fn(),
  countOverdueNeedingDecision: vi.fn(),
  countAwaitingPlanningFeedback: vi.fn(),
}));

vi.mock("@/lib/notifications/delivery", () => ({
  findDeliveryByKey: mocks.findDeliveryByKey,
  isDeliveryComplete: mocks.isDeliveryComplete,
  markDeliverySkipped: mocks.markDeliverySkipped,
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
  countWaitingFollowupsDue: mocks.countWaitingFollowupsDue,
  listWaitingFollowupsDue: mocks.listWaitingFollowupsDue,
  countOverdueNeedingDecision: mocks.countOverdueNeedingDecision,
  countAwaitingPlanningFeedback: mocks.countAwaitingPlanningFeedback,
}));

describe("review reminder scheduling", () => {
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
    daily_notifications_enabled: false,
    weekly_notifications_enabled: false,
    deadline_notifications_enabled: false,
    overload_notifications_enabled: false,
    morning_review_enabled: true,
    morning_review_time: "07:00",
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
    daily_notification_time: "08:00",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findDeliveryByKey.mockResolvedValue(null);
    mocks.isDeliveryComplete.mockReturnValue(false);
    mocks.sendNotificationToUser.mockResolvedValue({
      successCount: 1,
      subscriptionCount: 1,
      failureCount: 0,
      invalidCount: 0,
    });
    mocks.hasCompletedReviewSession.mockResolvedValue(false);
    mocks.listWaitingFollowupsDue.mockResolvedValue([]);
  });

  it("builds stable review dedup keys", () => {
    expect(buildMorningReviewDedupKey("user-1", "2026-07-12")).toBe(
      "morning_review:user-1:2026-07-12",
    );
    expect(buildEveningReviewDedupKey("user-1", "2026-07-12")).toBe(
      "evening_review:user-1:2026-07-12",
    );
    expect(buildWeeklyReviewDedupKey("user-1", "2026-07-07")).toBe(
      "weekly_review:user-1:2026-07-07",
    );
    expect(buildWaitingFollowupDedupKey("user-1", "task-9", "2026-07-12")).toBe(
      "waiting_followup:user-1:task-9:2026-07-12",
    );
    expect(buildOverdueDecisionDedupKey("user-1", "2026-07-12")).toBe(
      "overdue_decision:user-1:2026-07-12",
    );
    expect(buildPlanningFeedbackDedupKey("user-1", "2026-07-12")).toBe(
      "planning_feedback:user-1:2026-07-12",
    );
  });

  it("sends morning review when enabled, in window, and session incomplete", async () => {
    const now = new Date("2026-07-12T12:05:00.000Z");
    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
    );

    expect(mocks.hasCompletedReviewSession).toHaveBeenCalledWith(
      client,
      "user-1",
      "morning_daily",
      { dateKey: "2026-07-12" },
    );
    expect(mocks.sendNotificationToUser).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ notificationType: "morning_review" }),
    );
    expect(result.morningReview).toBe(1);
  });

  it("skips morning review when session already completed", async () => {
    mocks.hasCompletedReviewSession.mockResolvedValue(true);
    const now = new Date("2026-07-12T12:05:00.000Z");

    const result = await processScheduledNotifications(
      client,
      "user-1",
      basePreferences as never,
      0,
      now,
    );

    expect(
      mocks.sendNotificationToUser.mock.calls.some(
        ([, args]) => args.notificationType === "morning_review",
      ),
    ).toBe(false);
    expect(result.morningReview).toBe(0);
  });

  it("detects 07:00 in the 07:00-07:15 window", () => {
    expect(isScheduledTimeInWindow("07:00", 7 * 60, 7 * 60 + 15)).toBe(true);
    expect(isScheduledTimeInWindow("07:30", 7 * 60, 7 * 60 + 15)).toBe(false);
  });
});
