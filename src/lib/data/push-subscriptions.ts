import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import {
  inferDeviceName,
  listDeviceSummaries,
  registerPushSubscription,
  deactivateByEndpoint,
  deactivateById,
} from "@/lib/notifications/subscriptions";
import {
  pushSubscriptionInputSchema,
  type DeviceSummary,
} from "@/lib/notifications/schemas";

export async function savePushSubscription(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  contentEncoding?: string | null;
  userAgent?: string | null;
  isStandalone?: boolean;
}): Promise<DeviceSummary> {
  await requireAllowedUser();
  const parsed = pushSubscriptionInputSchema.parse({
    endpoint: input.endpoint,
    keys: input.keys,
    contentEncoding: input.contentEncoding,
  });

  const supabase = await createClient();
  const deviceName = inferDeviceName(
    input.userAgent ?? null,
    input.isStandalone ?? false,
  );

  return registerPushSubscription(supabase, {
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    deviceName,
    userAgent: input.userAgent ?? null,
    contentEncoding: parsed.contentEncoding ?? null,
  });
}

export async function listUserDevices(): Promise<DeviceSummary[]> {
  await requireAllowedUser();
  const supabase = await createClient();
  return listDeviceSummaries(supabase);
}

export async function deactivateCurrentDevice(
  endpoint: string,
): Promise<void> {
  await requireAllowedUser();
  const supabase = await createClient();
  const deactivated = await deactivateByEndpoint(supabase, endpoint);
  if (!deactivated) {
    throw new DatabaseError("Failed to deactivate device subscription");
  }
}

export async function deactivateDeviceById(
  deviceId: string,
): Promise<boolean> {
  await requireAllowedUser();
  const supabase = await createClient();
  return deactivateById(supabase, deviceId);
}

export async function setNotificationsEnabled(
  enabled: boolean,
): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("planning_preferences")
    .update({ notifications_enabled: enabled })
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to update notification settings");
  }
}
