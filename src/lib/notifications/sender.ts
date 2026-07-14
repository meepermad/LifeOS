import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  claimDelivery,
  updateDeliveryStatus,
} from "@/lib/notifications/delivery";
import { serializePayload } from "@/lib/notifications/payloads";
import type { NotificationPayload, SendResult } from "@/lib/notifications/schemas";
import {
  listActiveSubscriptions,
  recordPushFailure,
  recordPushSuccess,
  toWebPushSubscription,
} from "@/lib/notifications/subscriptions";
import { configureWebPush, webpush } from "@/lib/notifications/vapid";
import type { NotificationType } from "@/types/domain";

type DbClient = SupabaseClient<Database>;

function isPermanentPushError(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

function toSafeError(error: unknown): string {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = (error as { statusCode?: number }).statusCode;
    if (code) return `Push delivery failed (${code})`;
  }
  return "Push delivery failed";
}

export async function sendNotificationToUser(
  client: DbClient,
  input: {
    userId: string;
    notificationType: NotificationType;
    payload: NotificationPayload;
    deduplicationKey: string;
    scheduledFor: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    payloadSummary?: Record<string, unknown>;
  },
): Promise<SendResult> {
  configureWebPush();

  const claim = await claimDelivery(client, {
    userId: input.userId,
    notificationType: input.notificationType,
    scheduledFor: input.scheduledFor,
    deduplicationKey: input.deduplicationKey,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    payloadSummary: input.payloadSummary,
  });

  if (!claim) {
    return {
      successCount: 0,
      failureCount: 0,
      invalidCount: 0,
      subscriptionCount: 0,
    };
  }

  if (!claim.claimed) {
    // Another in-flight or completed delivery owns this occurrence.
    return {
      successCount: 0,
      failureCount: 0,
      invalidCount: 0,
      subscriptionCount: 0,
      deduplicated: true,
    };
  }

  const subscriptions = await listActiveSubscriptions(client, input.userId);
  const subscriptionCount = subscriptions.length;

  if (subscriptionCount === 0) {
    await updateDeliveryStatus(client, claim.delivery.id, {
      status: "skipped",
      subscriptionCount: 0,
      successCount: 0,
      failureCount: 0,
      safeError: "No active push subscription",
      sentAt: new Date().toISOString(),
    });
    return {
      successCount: 0,
      failureCount: 0,
      invalidCount: 0,
      subscriptionCount: 0,
    };
  }

  await updateDeliveryStatus(client, claim.delivery.id, {
    status: "sending",
    subscriptionCount,
    successCount: 0,
    failureCount: 0,
  });

  const body = serializePayload(input.payload);
  let successCount = 0;
  let failureCount = 0;
  let invalidCount = 0;
  let lastSafeError: string | null = null;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(toWebPushSubscription(sub), body, {
        TTL: 3600,
      });
      await recordPushSuccess(client, sub.id);
      successCount += 1;
    } catch (error) {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;
      const permanent = isPermanentPushError(statusCode);
      await recordPushFailure(client, sub.id, permanent);
      if (permanent) {
        invalidCount += 1;
      } else {
        failureCount += 1;
      }
      lastSafeError = toSafeError(error);
    }
  }

  const status =
    successCount === 0
      ? "failed"
      : failureCount + invalidCount > 0
        ? "partial"
        : "sent";

  await updateDeliveryStatus(client, claim.delivery.id, {
    status,
    subscriptionCount,
    successCount,
    failureCount: failureCount + invalidCount,
    safeError: lastSafeError,
    sentAt: new Date().toISOString(),
  });

  return {
    successCount,
    failureCount,
    invalidCount,
    subscriptionCount,
  };
}
