"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deactivateCurrentDevice,
  deactivateDeviceById,
  savePushSubscription,
  setNotificationsEnabled,
} from "@/lib/data/push-subscriptions";
import { updateNotificationPreferences } from "@/lib/data/notification-preferences";
import { buildTestPayload } from "@/lib/notifications/payloads";
import { sendNotificationToUser } from "@/lib/notifications/sender";
import { buildTestDedupKey } from "@/lib/notifications/scheduling";
import {
  pushSubscriptionInputSchema,
  notificationPreferencesSchema,
  type NotificationPreferencesInput,
} from "@/lib/notifications/schemas";
import { AppError } from "@/lib/errors/app-error";
import type { ActionResult } from "@/lib/actions/settings";

export type TestNotificationResult =
  | {
      success: true;
      successCount: number;
      failureCount: number;
      invalidCount: number;
      subscriptionCount: number;
    }
  | { success: false; error: string };

function toActionError(error: unknown): ActionResult {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      fieldErrors[issue.path.join(".") || "form"] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

export async function enableNotificationsAction(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  contentEncoding?: string | null;
  userAgent?: string | null;
  isStandalone?: boolean;
}): Promise<ActionResult> {
  try {
    pushSubscriptionInputSchema.parse({
      endpoint: input.endpoint,
      keys: input.keys,
      contentEncoding: input.contentEncoding,
    });

    await savePushSubscription(input);
    await setNotificationsEnabled(true);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function disableCurrentDeviceAction(
  endpoint: string,
): Promise<ActionResult> {
  try {
    if (!endpoint) {
      return { success: false, error: "No device subscription found" };
    }
    await deactivateCurrentDevice(endpoint);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deactivateDeviceAction(
  deviceId: string,
): Promise<ActionResult> {
  try {
    const deactivated = await deactivateDeviceById(deviceId);
    if (!deactivated) {
      return { success: false, error: "Device not found" };
    }
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

const testRateLimit = new Map<string, number>();

export async function sendTestNotificationAction(): Promise<TestNotificationResult> {
  try {
    const user = await requireAllowedUser();
    const now = Date.now();
    const lastSent = testRateLimit.get(user.id) ?? 0;
    if (now - lastSent < 60_000) {
      return { success: false, error: "Please wait before sending another test" };
    }

    const admin = createAdminClient();
    const minuteBucket = new Date().toISOString().slice(0, 16);
    const dedupKey = buildTestDedupKey(user.id, minuteBucket);

    const result = await sendNotificationToUser(admin, {
      userId: user.id,
      notificationType: "test",
      payload: buildTestPayload(),
      deduplicationKey: dedupKey,
      scheduledFor: new Date().toISOString(),
    });

    testRateLimit.set(user.id, now);

    return {
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      invalidCount: result.invalidCount,
      subscriptionCount: result.subscriptionCount,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to send test notification" };
  }
}

export async function updateNotificationPreferencesAction(
  input: NotificationPreferencesInput,
): Promise<ActionResult> {
  try {
    notificationPreferencesSchema.parse(input);
    await updateNotificationPreferences(input);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
