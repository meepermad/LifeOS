import { createAdminClient } from "@/lib/supabase/admin";
import { hashShortcutToken, verifyShortcutToken } from "@/lib/shortcuts/tokens";
import type { SpokenDetailLevel } from "@/types/domain";

export type AuthenticatedShortcutDevice = {
  id: string;
  userId: string;
  spokenDetailLevel: SpokenDetailLevel;
};

export async function authenticateShortcutDevice(
  token: string,
): Promise<AuthenticatedShortcutDevice | null> {
  if (!token.startsWith("los_")) {
    return null;
  }

  const tokenHash = hashShortcutToken(token);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("shortcut_devices")
    .select("id, user_id, token_hash, spoken_detail_level, is_active, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (!data.is_active || data.revoked_at) {
    return null;
  }

  if (!verifyShortcutToken(token, data.token_hash)) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    spokenDetailLevel: data.spoken_detail_level as SpokenDetailLevel,
  };
}

export async function getShortcutDedupResponse(
  deviceId: string,
  clientRequestId: string,
): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("shortcut_command_dedup")
    .select("response_json")
    .eq("device_id", deviceId)
    .eq("client_request_id", clientRequestId)
    .maybeSingle();

  return (data?.response_json as Record<string, unknown> | undefined) ?? null;
}

export async function storeShortcutDedupResponse(
  deviceId: string,
  clientRequestId: string,
  response: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("store_shortcut_command_dedup", {
    p_device_id: deviceId,
    p_client_request_id: clientRequestId,
    p_response_json: response,
  });

  if (error) {
    throw error;
  }

  return (data as Record<string, unknown>) ?? response;
}

export async function recordShortcutDeviceUsage(
  deviceId: string,
  success: boolean,
  errorCode?: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("record_shortcut_device_usage", {
    p_device_id: deviceId,
    p_success: success,
    p_error_code: errorCode ?? null,
  });
}
