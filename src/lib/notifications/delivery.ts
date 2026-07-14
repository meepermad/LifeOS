import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import type {
  NotificationDeliveryStatus,
  NotificationType,
} from "@/types/domain";

type DbClient = SupabaseClient<Database>;

export type DeliveryRecord = {
  id: string;
  deduplicationKey: string;
  status: NotificationDeliveryStatus;
};

export async function findDeliveryByKey(
  client: DbClient,
  deduplicationKey: string,
): Promise<DeliveryRecord | null> {
  const { data, error } = await client
    .from("notification_deliveries")
    .select("id, deduplication_key, status")
    .eq("deduplication_key", deduplicationKey)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    deduplicationKey: data.deduplication_key,
    status: data.status as NotificationDeliveryStatus,
  };
}

/**
 * Statuses that suppress another send for the same logical occurrence.
 * `failed` and retryable `skipped` rows may be reclaimed.
 */
export function suppressesDuplicateDelivery(
  status: NotificationDeliveryStatus,
): boolean {
  return (
    status === "pending" ||
    status === "sending" ||
    status === "sent" ||
    status === "partial"
  );
}

/**
 * Legacy helper: terminal successful outcomes only.
 * Premature/retryable `skipped` rows must not permanently suppress delivery.
 */
export function isDeliveryComplete(status: NotificationDeliveryStatus): boolean {
  return status === "sent" || status === "partial";
}

export function isRetryableDeliveryStatus(
  status: NotificationDeliveryStatus,
): boolean {
  return status === "failed" || status === "skipped";
}

export async function createDelivery(
  client: DbClient,
  input: {
    userId: string;
    notificationType: NotificationType;
    scheduledFor: string;
    deduplicationKey: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    payloadSummary?: Record<string, unknown>;
  },
): Promise<DeliveryRecord | null> {
  const { data, error } = await client
    .from("notification_deliveries")
    .insert({
      user_id: input.userId,
      notification_type: input.notificationType,
      scheduled_for: input.scheduledFor,
      deduplication_key: input.deduplicationKey,
      status: "pending",
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      payload_summary: (input.payloadSummary ?? null) as Json | null,
    })
    .select("id, deduplication_key, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      return findDeliveryByKey(client, input.deduplicationKey);
    }
    return null;
  }

  return {
    id: data.id,
    deduplicationKey: data.deduplication_key,
    status: data.status as NotificationDeliveryStatus,
  };
}

/**
 * Atomically claim a delivery for the logical occurrence.
 * Reclaims retryable `failed` / `skipped` rows so obsolete premature skips
 * cannot poison a later valid attempt for the same deduplication key.
 */
export async function claimDelivery(
  client: DbClient,
  input: {
    userId: string;
    notificationType: NotificationType;
    scheduledFor: string;
    deduplicationKey: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    payloadSummary?: Record<string, unknown>;
  },
): Promise<{ delivery: DeliveryRecord; claimed: boolean } | null> {
  const existing = await findDeliveryByKey(client, input.deduplicationKey);

  if (existing && suppressesDuplicateDelivery(existing.status)) {
    return { delivery: existing, claimed: false };
  }

  if (existing && isRetryableDeliveryStatus(existing.status)) {
    const { data, error } = await client
      .from("notification_deliveries")
      .update({
        status: "pending",
        scheduled_for: input.scheduledFor,
        period_start: input.periodStart ?? null,
        period_end: input.periodEnd ?? null,
        payload_summary: (input.payloadSummary ?? null) as Json | null,
        subscription_count: 0,
        success_count: 0,
        failure_count: 0,
        safe_error: null,
        sent_at: null,
      })
      .eq("id", existing.id)
      .in("status", ["failed", "skipped"])
      .select("id, deduplication_key, status")
      .maybeSingle();

    if (error) return null;

    if (!data) {
      const raced = await findDeliveryByKey(client, input.deduplicationKey);
      if (!raced) return null;
      return {
        delivery: raced,
        claimed: !suppressesDuplicateDelivery(raced.status)
          ? false
          : raced.status === "pending",
      };
    }

    return {
      delivery: {
        id: data.id,
        deduplicationKey: data.deduplication_key,
        status: data.status as NotificationDeliveryStatus,
      },
      claimed: true,
    };
  }

  const created = await createDelivery(client, input);
  if (!created) return null;

  // Unique race: another worker claimed first
  if (created.status !== "pending") {
    return {
      delivery: created,
      claimed: false,
    };
  }

  return { delivery: created, claimed: true };
}

export async function updateDeliveryStatus(
  client: DbClient,
  deliveryId: string,
  input: {
    status: NotificationDeliveryStatus;
    subscriptionCount: number;
    successCount: number;
    failureCount: number;
    safeError?: string | null;
    sentAt?: string | null;
  },
): Promise<void> {
  await client
    .from("notification_deliveries")
    .update({
      status: input.status,
      subscription_count: input.subscriptionCount,
      success_count: input.successCount,
      failure_count: input.failureCount,
      safe_error: input.safeError ?? null,
      sent_at: input.sentAt ?? null,
    })
    .eq("id", deliveryId);
}

export async function markDeliverySkipped(
  client: DbClient,
  input: {
    userId: string;
    notificationType: NotificationType;
    scheduledFor: string;
    deduplicationKey: string;
    reason: string;
  },
): Promise<void> {
  const claimed = await claimDelivery(client, {
    userId: input.userId,
    notificationType: input.notificationType,
    scheduledFor: input.scheduledFor,
    deduplicationKey: input.deduplicationKey,
  });

  if (!claimed || !claimed.claimed) return;

  await updateDeliveryStatus(client, claimed.delivery.id, {
    status: "skipped",
    subscriptionCount: 0,
    successCount: 0,
    failureCount: 0,
    safeError: input.reason,
    sentAt: new Date().toISOString(),
  });
}

export async function findRecentDelivery(
  client: DbClient,
  userId: string,
  notificationType: NotificationType,
  since: string,
): Promise<DeliveryRecord | null> {
  const { data } = await client
    .from("notification_deliveries")
    .select("id, deduplication_key, status")
    .eq("user_id", userId)
    .eq("notification_type", notificationType)
    .gte("created_at", since)
    .in("status", ["sent", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    deduplicationKey: data.deduplication_key,
    status: data.status as NotificationDeliveryStatus,
  };
}
