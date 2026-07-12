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

export function isDeliveryComplete(status: NotificationDeliveryStatus): boolean {
  return status === "sent" || status === "partial" || status === "skipped";
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
  const existing = await findDeliveryByKey(client, input.deduplicationKey);
  if (existing && isDeliveryComplete(existing.status)) return;

  if (!existing) {
    await client.from("notification_deliveries").insert({
      user_id: input.userId,
      notification_type: input.notificationType,
      scheduled_for: input.scheduledFor,
      deduplication_key: input.deduplicationKey,
      status: "skipped",
      safe_error: input.reason,
      sent_at: new Date().toISOString(),
    });
    return;
  }

  await updateDeliveryStatus(client, existing.id, {
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
