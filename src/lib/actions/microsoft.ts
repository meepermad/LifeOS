"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  disconnectMicrosoftConnection,
  getMicrosoftConnectionSafe,
} from "@/lib/data/microsoft-connections";
import {
  refreshMicrosoftCalendars,
  syncMicrosoftCalendarAction,
} from "@/lib/integrations/microsoft/sync";
import {
  updateMicrosoftCalendarPreferences,
} from "@/lib/integrations/microsoft/calendars";
import { createSessionSyncContext } from "@/lib/integrations/microsoft/sync-context";
import { getMicrosoftConnectionForUser } from "@/lib/integrations/microsoft/sync-data";
import type {
  MicrosoftSyncResult,
  SafeMicrosoftCalendar,
  SafeMicrosoftConnectionStatus,
} from "@/lib/integrations/microsoft/schemas";
import { AppError } from "@/lib/errors/app-error";
import { assertMicrosoftIntegrationEnabled, isMicrosoftIntegrationEnabled } from "@/lib/integrations/microsoft/feature-flag";
import { listMicrosoftCalendarsForConnection, toSafeMicrosoftCalendars } from "@/lib/integrations/microsoft/calendars";

function assertMicrosoftActionsEnabled(): void {
  assertMicrosoftIntegrationEnabled();
}

export type MicrosoftActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function toMicrosoftActionError<T = void>(error: unknown): MicrosoftActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return {
      success: false,
      error: "Validation failed",
      fieldErrors,
    };
  }

  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }

  return { success: false, error: "An unexpected error occurred" };
}

function revalidateMicrosoftPaths() {
  revalidatePath("/imports");
  revalidatePath("/settings", "layout");
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/tasks");
}

export async function syncMicrosoftAction(): Promise<
  MicrosoftActionResult<MicrosoftSyncResult>
> {
  try {
    assertMicrosoftActionsEnabled();
    const result = await syncMicrosoftCalendarAction();
    revalidateMicrosoftPaths();
    return { success: true, data: result };
  } catch (error) {
    return toMicrosoftActionError(error);
  }
}

export async function refreshMicrosoftCalendarsAction(): Promise<
  MicrosoftActionResult<SafeMicrosoftCalendar[]>
> {
  try {
    assertMicrosoftActionsEnabled();
    await refreshMicrosoftCalendars();
    const ctx = await createSessionSyncContext();
    const connection = await getMicrosoftConnectionForUser(ctx);
    if (!connection) {
      return { success: false, error: "Microsoft account is not connected" };
    }

    const calendars = await listMicrosoftCalendarsForConnection(ctx, connection.id);
    revalidateMicrosoftPaths();
    return { success: true, data: toSafeMicrosoftCalendars(calendars) };
  } catch (error) {
    return toMicrosoftActionError(error);
  }
}

export async function updateMicrosoftCalendarSelectionAction(input: {
  calendarId: string;
  syncEnabled?: boolean;
  isVisible?: boolean;
}): Promise<MicrosoftActionResult<SafeMicrosoftCalendar>> {
  try {
    assertMicrosoftActionsEnabled();
    const ctx = await createSessionSyncContext();
    const connection = await getMicrosoftConnectionForUser(ctx);
    if (!connection) {
      return { success: false, error: "Microsoft account is not connected" };
    }

    const calendar = await updateMicrosoftCalendarPreferences(ctx, {
      connectionId: connection.id,
      calendarId: input.calendarId,
      syncEnabled: input.syncEnabled,
      isVisible: input.isVisible,
    });

    revalidateMicrosoftPaths();
    return { success: true, data: calendar };
  } catch (error) {
    return toMicrosoftActionError(error);
  }
}

export async function disconnectMicrosoftAction(): Promise<MicrosoftActionResult> {
  try {
    assertMicrosoftActionsEnabled();
    await disconnectMicrosoftConnection();
    revalidateMicrosoftPaths();
    return { success: true };
  } catch (error) {
    return toMicrosoftActionError(error);
  }
}

export async function getMicrosoftConnectionStatusAction(): Promise<SafeMicrosoftConnectionStatus> {
  if (!isMicrosoftIntegrationEnabled()) {
    return {
      isConfigured: false,
      displayLabel: null,
      status: "disconnected",
      requiresReauthentication: false,
      lastSyncAttempt: null,
      lastSuccessfulSync: null,
      lastSyncTrigger: null,
      lastError: null,
    };
  }

  return getMicrosoftConnectionSafe();
}

export async function getMicrosoftCalendarsAction(): Promise<SafeMicrosoftCalendar[]> {
  if (!isMicrosoftIntegrationEnabled()) {
    return [];
  }

  const ctx = await createSessionSyncContext();
  const connection = await getMicrosoftConnectionForUser(ctx);
  if (!connection) {
    return [];
  }

  const calendars = await listMicrosoftCalendarsForConnection(ctx, connection.id);
  return toSafeMicrosoftCalendars(calendars);
}
