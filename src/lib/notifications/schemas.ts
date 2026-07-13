import { z } from "zod";
import type {
  NotificationDeliveryStatus,
  NotificationPrivacyMode,
  NotificationType,
} from "@/types/domain";

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 512;

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1).max(MAX_KEY_LENGTH),
  auth: z.string().min(1).max(MAX_KEY_LENGTH),
});

export const pushSubscriptionInputSchema = z
  .object({
    endpoint: z.string().url().max(MAX_ENDPOINT_LENGTH),
    keys: pushSubscriptionKeysSchema,
    contentEncoding: z.string().max(32).optional().nullable(),
    userId: z.string().uuid().optional(),
  })
  .strict();

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

export const notificationPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(300),
  tag: z.string().max(64).optional(),
  url: z.string().max(256),
  badgeCount: z.number().int().min(0).optional(),
});

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

export const deviceSummarySchema = z.object({
  id: z.string().uuid(),
  deviceName: z.string().nullable(),
  isActive: z.boolean(),
  lastSuccessfulPush: z.string().nullable(),
  lastFailedPush: z.string().nullable(),
  createdAt: z.string(),
});

export type DeviceSummary = z.infer<typeof deviceSummarySchema>;

export const notificationPreferencesSchema = z
  .object({
    notificationsEnabled: z.boolean().optional(),
    notificationPrivacyMode: z.enum(["private", "detailed"] as const),
    dailyNotificationsEnabled: z.boolean(),
    weeklyNotificationsEnabled: z.boolean(),
    deadlineNotificationsEnabled: z.boolean(),
    overloadNotificationsEnabled: z.boolean(),
    deadlineWarningHours: z.coerce.number().int().min(1).max(168),
    dailyNotificationTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional()
      .nullable()
      .or(z.literal("")),
    weeklyNotificationDay: z.coerce.number().int().min(0).max(6),
    weeklyNotificationTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional()
      .nullable()
      .or(z.literal("")),
    quietHoursStart: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional()
      .nullable()
      .or(z.literal("")),
    quietHoursEnd: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional()
      .nullable()
      .or(z.literal("")),
    morningReviewEnabled: z.boolean().optional(),
    morningReviewTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional()
      .nullable()
      .or(z.literal("")),
    eveningReviewEnabled: z.boolean().optional(),
    eveningReviewTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional()
      .nullable()
      .or(z.literal("")),
    weeklyReviewReminderEnabled: z.boolean().optional(),
    waitingFollowupEnabled: z.boolean().optional(),
    overdueDecisionReminderEnabled: z.boolean().optional(),
    planningFeedbackReminderEnabled: z.boolean().optional(),
  })
  .strict();

export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;

export type SendResult = {
  successCount: number;
  failureCount: number;
  invalidCount: number;
  subscriptionCount: number;
};

export const NOTIFICATION_TYPES = [
  "test",
  "daily_agenda",
  "weekly_summary",
  "deadline_warning",
  "overload_warning",
  "stale_timer",
  "morning_review",
  "evening_review",
  "weekly_review",
  "waiting_followup",
  "overdue_decision",
  "planning_feedback",
] as const satisfies readonly NotificationType[];

export const DELIVERY_STATUSES = [
  "pending",
  "sending",
  "sent",
  "partial",
  "failed",
  "skipped",
] as const satisfies readonly NotificationDeliveryStatus[];

export const PRIVACY_MODES = [
  "private",
  "detailed",
] as const satisfies readonly NotificationPrivacyMode[];
