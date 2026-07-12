"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deactivateCurrentDevice,
  deactivateDeviceById,
  isCurrentEndpointRegistered,
  savePushSubscription,
  setNotificationsEnabled,
} from "@/lib/data/push-subscriptions";
import { updateNotificationPreferences } from "@/lib/data/notification-preferences";
import { buildTestPayload } from "@/lib/notifications/payloads";
import {
  appErrorToHttpStatus,
  logPushSubscriptionPersistenceError,
} from "@/lib/notifications/push-subscription-errors";
import { PUSH_ENABLE_STAGES } from "@/lib/notifications/push-enable-flow";
import { sendNotificationToUser } from "@/lib/notifications/sender";
import { buildTestDedupKey } from "@/lib/notifications/scheduling";
import {
  pushSubscriptionInputSchema,
  notificationPreferencesSchema,
  type NotificationPreferencesInput,
} from "@/lib/notifications/schemas";
import { AppError } from "@/lib/errors/app-error";
import type { ActionResult } from "@/lib/actions/settings";

export type EnableNotificationsResult =
  | { success: true }
  | {
      success: false;
      error: string;
      stage: typeof PUSH_ENABLE_STAGES.PERSIST | "validation";
      errorCode?: string;
      httpStatus?: number;
      fieldErrors?: Record<string, string>;
    };

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

function toEnableActionError(error: unknown): EnableNotificationsResult {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      fieldErrors[issue.path.join(".") || "form"] = issue.message;
    }
    return {
      success: false,
      stage: "validation",
      error: "LifeOS could not save this device subscription.",
      errorCode: "VALIDATION_ERROR",
      httpStatus: 400,
      fieldErrors,
    };
  }

  if (error instanceof AppError) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `Push enable failed stage=persist name=${error.name} code=${error.code} status=${error.statusCode}`,
      );
    }
    return {
      success: false,
      stage: PUSH_ENABLE_STAGES.PERSIST,
      error: error.message,
      errorCode: error.code,
      httpStatus: appErrorToHttpStatus(error),
    };
  }

  logPushSubscriptionPersistenceError(null);
  return {
    success: false,
    stage: PUSH_ENABLE_STAGES.PERSIST,
    error: "LifeOS could not save this device subscription.",
    errorCode: "UNEXPECTED_ERROR",
    httpStatus: 500,
  };
}

export async function enableNotificationsAction(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  contentEncoding?: string | null;
  userAgent?: string | null;
  isStandalone?: boolean;
}): Promise<EnableNotificationsResult> {
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
    return toEnableActionError(error);
  }
}

export async function checkEndpointRegistrationAction(
  endpoint: string,
): Promise<{ registered: boolean }> {
  try {
    if (!endpoint) {
      return { registered: false };
    }
    const registered = await isCurrentEndpointRegistered(endpoint);
    return { registered };
  } catch {
    return { registered: false };
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
