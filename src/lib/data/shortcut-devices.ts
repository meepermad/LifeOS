import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { generateShortcutToken } from "@/lib/shortcuts/tokens";
import type { SpokenDetailLevel } from "@/types/domain";

export type ShortcutDeviceSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  spokenDetailLevel: SpokenDetailLevel;
  isActive: boolean;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  revokedAt: string | null;
};

function mapRow(row: {
  id: string;
  name: string;
  token_prefix: string;
  spoken_detail_level: string;
  is_active: boolean;
  last_used_at?: string | null;
  last_success_at?: string | null;
  last_error_code?: string | null;
  created_at: string;
  revoked_at?: string | null;
}): ShortcutDeviceSummary {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    spokenDetailLevel: row.spoken_detail_level as SpokenDetailLevel,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
    lastErrorCode: row.last_error_code ?? null,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? null,
  };
}

export async function registerShortcutDevice(input: {
  name: string;
  spokenDetailLevel: SpokenDetailLevel;
}): Promise<{ device: ShortcutDeviceSummary; token: string }> {
  await requireAllowedUser();
  const supabase = await createClient();
  const generated = generateShortcutToken();

  const { data, error } = await supabase.rpc("register_shortcut_device", {
    p_name: input.name,
    p_token_hash: generated.tokenHash,
    p_token_prefix: generated.tokenPrefix,
    p_spoken_detail_level: input.spokenDetailLevel,
  });

  if (error || !data?.[0]) {
    throw new DatabaseError("Failed to register shortcut device");
  }

  return {
    device: mapRow(data[0]),
    token: generated.token,
  };
}

export async function listShortcutDevices(): Promise<ShortcutDeviceSummary[]> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("list_shortcut_devices");
  if (error) {
    throw new DatabaseError("Failed to list shortcut devices");
  }

  return (data ?? []).map(mapRow);
}

export async function rotateShortcutDeviceToken(
  deviceId: string,
): Promise<{ device: ShortcutDeviceSummary; token: string }> {
  await requireAllowedUser();
  const supabase = await createClient();
  const generated = generateShortcutToken();

  const { data, error } = await supabase.rpc("rotate_shortcut_device_token", {
    p_device_id: deviceId,
    p_token_hash: generated.tokenHash,
    p_token_prefix: generated.tokenPrefix,
  });

  if (error || !data?.[0]) {
    throw new DatabaseError("Failed to rotate shortcut device token");
  }

  return {
    device: mapRow(data[0]),
    token: generated.token,
  };
}

export async function revokeShortcutDevice(deviceId: string): Promise<boolean> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("revoke_shortcut_device", {
    p_device_id: deviceId,
  });

  if (error) {
    throw new DatabaseError("Failed to revoke shortcut device");
  }

  return Boolean(data);
}

export async function updateShortcutDevice(input: {
  deviceId: string;
  name: string;
  spokenDetailLevel: SpokenDetailLevel;
}): Promise<boolean> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("update_shortcut_device", {
    p_device_id: input.deviceId,
    p_name: input.name,
    p_spoken_detail_level: input.spokenDetailLevel,
  });

  if (error) {
    throw new DatabaseError("Failed to update shortcut device");
  }

  return Boolean(data);
}
