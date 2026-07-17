"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { z } from "zod";
import {
  listShortcutDevices,
  registerShortcutDevice,
  revokeShortcutDevice,
  rotateShortcutDeviceToken,
  updateShortcutDevice,
} from "@/lib/data/shortcut-devices";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { AppError } from "@/lib/errors/app-error";
import { getServerEnv } from "@/lib/security/env";
import type { SpokenDetailLevel } from "@/types/domain";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  spokenDetailLevel: z.enum(["private", "detailed"]),
});

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

export async function registerShortcutDeviceAction(
  input: z.infer<typeof registerSchema>,
): Promise<
  ActionResult<{
    deviceId: string;
    token: string;
    tokenPrefix: string;
    apiUrl: string;
  }>
> {
  try {
    await requireAllowedUser();
    const parsed = registerSchema.parse(input);
    const result = await registerShortcutDevice({
      name: parsed.name,
      spokenDetailLevel: parsed.spokenDetailLevel as SpokenDetailLevel,
    });
    const apiUrl = `${getServerEnv().NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""}/api/shortcuts/command`;
    revalidatePath("/settings", "layout");
    return {
      success: true,
      data: {
        deviceId: result.device.id,
        token: result.token,
        tokenPrefix: result.device.tokenPrefix,
        apiUrl,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listShortcutDevicesAction() {
  try {
    await requireAllowedUser();
    const devices = await listShortcutDevices();
    const apiUrl = `${getServerEnv().NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""}/api/shortcuts/command`;
    return { success: true as const, data: { devices, apiUrl } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function rotateShortcutDeviceTokenAction(deviceId: string) {
  try {
    await requireAllowedUser();
    const result = await rotateShortcutDeviceToken(deviceId);
    revalidatePath("/settings", "layout");
    return {
      success: true as const,
      data: {
        token: result.token,
        tokenPrefix: result.device.tokenPrefix,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function revokeShortcutDeviceAction(deviceId: string) {
  try {
    await requireAllowedUser();
    await revokeShortcutDevice(deviceId);
    revalidatePath("/settings", "layout");
    return { success: true as const };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateShortcutDeviceAction(input: {
  deviceId: string;
  name: string;
  spokenDetailLevel: SpokenDetailLevel;
}) {
  try {
    await requireAllowedUser();
    await updateShortcutDevice(input);
    revalidatePath("/settings", "layout");
    return { success: true as const };
  } catch (error) {
    return toActionError(error);
  }
}

export async function testShortcutDeviceAction(deviceId: string) {
  try {
    await requireAllowedUser();
    const devices = await listShortcutDevices();
    const device = devices.find((entry) => entry.id === deviceId);
    if (!device || device.revokedAt) {
      return { success: false, error: "Shortcut device not found." };
    }
    return {
      success: true as const,
      data: {
        message: `${device.name} is registered. Use Rotate token to test a fresh connection.`,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}
