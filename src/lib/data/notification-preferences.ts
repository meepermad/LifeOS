import { normalizeOptionalTime } from "@/lib/validation/preferences";
import { notificationPreferencesSchema } from "@/lib/notifications/schemas";
import type { NotificationPreferencesInput } from "@/lib/notifications/schemas";
import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { PlanningPreferencesRow } from "@/types/domain";
import type { Database } from "@/types/database.types";

type PreferencesUpdate =
  Database["public"]["Tables"]["planning_preferences"]["Update"];

export async function updateNotificationPreferences(
  input: NotificationPreferencesInput,
): Promise<PlanningPreferencesRow> {
  const user = await requireAllowedUser();
  const parsed = notificationPreferencesSchema.parse(input);
  const supabase = await createClient();

  const updatePayload: PreferencesUpdate = {
    notification_privacy_mode: parsed.notificationPrivacyMode,
    daily_notifications_enabled: parsed.dailyNotificationsEnabled,
    weekly_notifications_enabled: parsed.weeklyNotificationsEnabled,
    deadline_notifications_enabled: parsed.deadlineNotificationsEnabled,
    overload_notifications_enabled: parsed.overloadNotificationsEnabled,
    deadline_warning_hours: parsed.deadlineWarningHours,
    daily_notification_time: normalizeOptionalTime(parsed.dailyNotificationTime),
    weekly_notification_day: parsed.weeklyNotificationDay,
    weekly_notification_time: normalizeOptionalTime(parsed.weeklyNotificationTime),
    quiet_hours_start: normalizeOptionalTime(parsed.quietHoursStart),
    quiet_hours_end: normalizeOptionalTime(parsed.quietHoursEnd),
    ...(parsed.morningReviewEnabled !== undefined
      ? { morning_review_enabled: parsed.morningReviewEnabled }
      : {}),
    ...(parsed.morningReviewTime !== undefined
      ? { morning_review_time: normalizeOptionalTime(parsed.morningReviewTime) }
      : {}),
    ...(parsed.eveningReviewEnabled !== undefined
      ? { evening_review_enabled: parsed.eveningReviewEnabled }
      : {}),
    ...(parsed.eveningReviewTime !== undefined
      ? { evening_review_time: normalizeOptionalTime(parsed.eveningReviewTime) }
      : {}),
    ...(parsed.weeklyReviewReminderEnabled !== undefined
      ? { weekly_review_reminder_enabled: parsed.weeklyReviewReminderEnabled }
      : {}),
    ...(parsed.waitingFollowupEnabled !== undefined
      ? { waiting_followup_enabled: parsed.waitingFollowupEnabled }
      : {}),
    ...(parsed.overdueDecisionReminderEnabled !== undefined
      ? {
          overdue_decision_reminder_enabled:
            parsed.overdueDecisionReminderEnabled,
        }
      : {}),
    ...(parsed.planningFeedbackReminderEnabled !== undefined
      ? {
          planning_feedback_reminder_enabled:
            parsed.planningFeedbackReminderEnabled,
        }
      : {}),
  } as PreferencesUpdate;

  if (parsed.notificationsEnabled !== undefined) {
    updatePayload.notifications_enabled = parsed.notificationsEnabled;
  }

  const { data, error } = await supabase
    .from("planning_preferences")
    .update(updatePayload)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update notification preferences");
  }

  return data;
}
