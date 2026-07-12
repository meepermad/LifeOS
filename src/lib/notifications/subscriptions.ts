import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DeviceSummary } from "@/lib/notifications/schemas";
import type { PushSubscriptionRow } from "@/types/domain";

type DbClient = SupabaseClient<Database>;

type SafeDeviceRow = {
  id: string;
  device_name: string | null;
  is_active: boolean;
  last_successful_push: string | null;
  last_failed_push: string | null;
  created_at: string;
};

function mapSafeDeviceRow(row: SafeDeviceRow): DeviceSummary {
  return {
    id: row.id,
    deviceName: row.device_name,
    isActive: row.is_active,
    lastSuccessfulPush: row.last_successful_push,
    lastFailedPush: row.last_failed_push,
    createdAt: row.created_at,
  };
}

/** Authenticated user path — RPC only; no direct table access. */
export async function registerPushSubscription(
  client: DbClient,
  input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    deviceName?: string | null;
    userAgent?: string | null;
    contentEncoding?: string | null;
  },
): Promise<DeviceSummary> {
  const { data, error } = await client.rpc("register_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_device_name: input.deviceName ?? undefined,
    p_user_agent: input.userAgent ?? undefined,
    p_content_encoding: input.contentEncoding ?? undefined,
  });

  if (error || !data?.[0]) {
    throw new Error("Failed to save push subscription");
  }

  return mapSafeDeviceRow(data[0]);
}

/** Authenticated user path — RPC returns safe columns only. */
export async function listDeviceSummaries(
  client: DbClient,
): Promise<DeviceSummary[]> {
  const { data, error } = await client.rpc("list_push_device_summaries");

  if (error) return [];
  return (data ?? []).map(mapSafeDeviceRow);
}

/** Authenticated user path — deactivate by opaque device id. */
export async function deactivateById(
  client: DbClient,
  subscriptionId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("deactivate_push_subscription", {
    p_subscription_id: subscriptionId,
  });

  if (error) return false;
  return data === true;
}

/** Authenticated user path — deactivate current browser subscription. */
export async function deactivateByEndpoint(
  client: DbClient,
  endpoint: string,
): Promise<boolean> {
  const { data, error } = await client.rpc(
    "deactivate_push_subscription_by_endpoint",
    { p_endpoint: endpoint },
  );

  if (error) return false;
  return data === true;
}

/**
 * Service-role only — reads full subscription rows for Web Push delivery.
 * Do not call with the authenticated session client.
 */
export async function listActiveSubscriptions(
  client: DbClient,
  userId: string,
): Promise<PushSubscriptionRow[]> {
  const { data, error } = await client
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) return [];
  return data ?? [];
}

/** Service-role only — update delivery timestamps after successful push. */
export async function recordPushSuccess(
  client: DbClient,
  subscriptionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await client
    .from("push_subscriptions")
    .update({
      last_successful_push: now,
      failure_count: 0,
    })
    .eq("id", subscriptionId);
}

/** Service-role only — record failure and optionally deactivate subscription. */
export async function recordPushFailure(
  client: DbClient,
  subscriptionId: string,
  deactivate: boolean,
): Promise<void> {
  const { data } = await client
    .from("push_subscriptions")
    .select("failure_count")
    .eq("id", subscriptionId)
    .single();

  const failureCount = (data?.failure_count ?? 0) + 1;
  const now = new Date().toISOString();

  await client
    .from("push_subscriptions")
    .update({
      last_failed_push: now,
      failure_count: failureCount,
      ...(deactivate ? { is_active: false } : {}),
    })
    .eq("id", subscriptionId);
}

export function toWebPushSubscription(row: PushSubscriptionRow) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

export function inferDeviceName(
  userAgent: string | null | undefined,
  isStandalone: boolean,
): string {
  if (!userAgent) return "Unknown device";

  const ua = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return isStandalone ? "iPhone PWA" : "iPhone browser";
  }
  if (/android/.test(ua)) {
    return isStandalone ? "Android PWA" : "Android browser";
  }
  if (/macintosh|mac os/.test(ua)) {
    return isStandalone ? "Mac PWA" : "Desktop browser";
  }
  if (/windows/.test(ua)) {
    return isStandalone ? "Windows PWA" : "Desktop browser";
  }
  if (/linux/.test(ua)) {
    return "Desktop browser";
  }

  return "Unknown device";
}

export function toDeviceSummary(row: PushSubscriptionRow): DeviceSummary {
  return {
    id: row.id,
    deviceName: row.device_name,
    isActive: row.is_active,
    lastSuccessfulPush: row.last_successful_push,
    lastFailedPush: row.last_failed_push,
    createdAt: row.created_at,
  };
}
