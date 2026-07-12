import { AppError, ValidationError } from "@/lib/errors/app-error";
import { listGraphCalendars, GraphApiError, syncGraphCalendarDelta } from "@/lib/integrations/microsoft/graph-client";
import {
  computeSyncWindowUtc,
  normalizeMicrosoftEvents,
  shouldResetSyncWindow,
} from "@/lib/integrations/microsoft/normalize";
import { upsertDiscoveredMicrosoftCalendars } from "@/lib/integrations/microsoft/calendars";
import type {
  MicrosoftCalendarSyncResult,
  MicrosoftSyncResult,
} from "@/lib/integrations/microsoft/schemas";
import {
  createSessionSyncContext,
  type MicrosoftSyncContext,
  type MicrosoftSyncTrigger,
} from "@/lib/integrations/microsoft/sync-context";
import {
  acquireGraphAccessToken,
  createTokenCacheSession,
  isInteractionRequiredError,
  markMicrosoftReauthenticationRequired,
  persistTokenCacheIfChanged,
} from "@/lib/integrations/microsoft/token-cache";
import {
  claimConnectionForSync,
  clearMicrosoftSyncCursor,
  getMicrosoftConnectionForUser,
  getMicrosoftConnectionWithCredentials,
  getSyncStateForCalendar,
  listEnabledMicrosoftCalendars,
  markConnectionSyncError,
  markConnectionSyncSuccess,
  upsertMicrosoftEvent,
  upsertMicrosoftSyncState,
} from "@/lib/integrations/microsoft/sync-data";
import { getMicrosoftConnectionSafe } from "@/lib/data/microsoft-connections";

function emptyEventCounts() {
  return { created: 0, updated: 0, unchanged: 0, cancelled: 0, warnings: 0 };
}

function toSafeSyncError(error: unknown): string {
  if (error instanceof GraphApiError) {
    return error.message;
  }
  if (error instanceof AppError) {
    return error.message;
  }
  return "Microsoft synchronization failed";
}

async function refreshMicrosoftCalendarsInternal(
  ctx: MicrosoftSyncContext,
  connectionId: string,
  accessToken: string,
): Promise<void> {
  const graphCalendars = await listGraphCalendars(accessToken);
  await upsertDiscoveredMicrosoftCalendars(ctx, {
    connectionId,
    calendars: graphCalendars,
  });
}

async function syncMicrosoftCalendar(
  ctx: MicrosoftSyncContext,
  input: {
    connectionId: string;
    accessToken: string;
    calendarId: string;
    externalCalendarId: string;
    calendarLabel: string;
  },
): Promise<MicrosoftCalendarSyncResult> {
  const counts = emptyEventCounts();
  const syncState = await getSyncStateForCalendar(ctx, input.calendarId);
  const { windowStart, windowEnd } = computeSyncWindowUtc();

  const needsFullSync =
    !syncState?.sync_cursor ||
    shouldResetSyncWindow(syncState.sync_window_end);

  let isFullSync = needsFullSync;

  const deltaUrl = needsFullSync ? null : syncState?.sync_cursor ?? null;

  try {
    const deltaResult = await syncGraphCalendarDelta({
      accessToken: input.accessToken,
      externalCalendarId: input.externalCalendarId,
      deltaUrl,
      windowStart,
      windowEnd,
    });

    const normalized = normalizeMicrosoftEvents(deltaResult.events);
    counts.warnings += normalized.warnings + deltaResult.warnings;

    for (const event of normalized.events) {
      const result = await upsertMicrosoftEvent(ctx, input.calendarId, event);
      if (result === "created") counts.created += 1;
      if (result === "updated") counts.updated += 1;
      if (result === "unchanged") counts.unchanged += 1;
      if (result === "cancelled") counts.cancelled += 1;
    }

    await upsertMicrosoftSyncState(ctx, {
      connectionId: input.connectionId,
      calendarId: input.calendarId,
      syncCursor: deltaResult.deltaLink!,
      syncWindowStart: windowStart,
      syncWindowEnd: windowEnd,
      isFullSync,
    });

    return {
      calendarId: input.calendarId,
      calendarLabel: input.calendarLabel,
      events: counts,
      success: true,
      error: null,
    };
  } catch (error) {
    if (error instanceof GraphApiError && error.requiresDeltaReset) {
      await clearMicrosoftSyncCursor(ctx, input.calendarId);
      isFullSync = true;

      const deltaResult = await syncGraphCalendarDelta({
        accessToken: input.accessToken,
        externalCalendarId: input.externalCalendarId,
        deltaUrl: null,
        windowStart,
        windowEnd,
      });

      const normalized = normalizeMicrosoftEvents(deltaResult.events);
      counts.warnings += normalized.warnings + deltaResult.warnings;

      for (const event of normalized.events) {
        const result = await upsertMicrosoftEvent(ctx, input.calendarId, event);
        if (result === "created") counts.created += 1;
        if (result === "updated") counts.updated += 1;
        if (result === "unchanged") counts.unchanged += 1;
        if (result === "cancelled") counts.cancelled += 1;
      }

      await upsertMicrosoftSyncState(ctx, {
        connectionId: input.connectionId,
        calendarId: input.calendarId,
        syncCursor: deltaResult.deltaLink!,
        syncWindowStart: windowStart,
        syncWindowEnd: windowEnd,
        isFullSync: true,
      });

      return {
        calendarId: input.calendarId,
        calendarLabel: input.calendarLabel,
        events: counts,
        success: true,
        error: null,
      };
    }

    return {
      calendarId: input.calendarId,
      calendarLabel: input.calendarLabel,
      events: counts,
      success: false,
      error: toSafeSyncError(error),
    };
  }
}

export async function syncMicrosoftForUser(input: {
  ctx: MicrosoftSyncContext;
  connectionId: string;
  trigger: MicrosoftSyncTrigger;
  discoverCalendars?: boolean;
}): Promise<MicrosoftSyncResult> {
  const { ctx, connectionId, trigger } = input;

  await getMicrosoftConnectionWithCredentials(ctx, connectionId);

  const claimResult = await claimConnectionForSync(ctx, connectionId);
  if (claimResult === "already_running") {
    throw new ValidationError("Microsoft synchronization is already in progress");
  }
  if (claimResult === "not_found") {
    throw new ValidationError("Microsoft account is not connected");
  }
  if (claimResult === "not_connected") {
    throw new ValidationError("Microsoft connection is not ready for synchronization");
  }

  let connection = await getMicrosoftConnectionWithCredentials(ctx, connectionId);

  try {
    const session = createTokenCacheSession(connection);
    const { accessToken } = await acquireGraphAccessToken(session);
    connection = await persistTokenCacheIfChanged(ctx, connection, session);

    if (input.discoverCalendars) {
      await refreshMicrosoftCalendarsInternal(ctx, connectionId, accessToken);
    }

    const calendars = await listEnabledMicrosoftCalendars(ctx, connectionId);
    const calendarResults: MicrosoftCalendarSyncResult[] = [];
    const aggregate = emptyEventCounts();

    for (const calendar of calendars) {
      if (!calendar.external_calendar_id) {
        continue;
      }

      const result = await syncMicrosoftCalendar(ctx, {
        connectionId,
        accessToken,
        calendarId: calendar.id,
        externalCalendarId: calendar.external_calendar_id,
        calendarLabel: calendar.name,
      });

      calendarResults.push(result);
      aggregate.created += result.events.created;
      aggregate.updated += result.events.updated;
      aggregate.unchanged += result.events.unchanged;
      aggregate.cancelled += result.events.cancelled;
      aggregate.warnings += result.events.warnings;
    }

    const failedCalendars = calendarResults.filter((result) => !result.success);
    if (failedCalendars.length === calendarResults.length && calendarResults.length > 0) {
      await markConnectionSyncError(
        ctx,
        connectionId,
        failedCalendars[0]?.error ?? "Microsoft synchronization failed",
      );
    } else {
      await markConnectionSyncSuccess(ctx, connectionId, trigger);
    }

    return {
      calendars: calendarResults,
      events: aggregate,
      warnings: aggregate.warnings,
    };
  } catch (error) {
    const message = toSafeSyncError(error);

    if (isInteractionRequiredError(error) || (error instanceof GraphApiError && error.requiresReauthentication)) {
      await markMicrosoftReauthenticationRequired(ctx, connectionId, message);
    } else {
      await markConnectionSyncError(ctx, connectionId, message);
    }

    throw error instanceof AppError ? error : new ValidationError(message);
  }
}

export async function syncMicrosoftCalendarAction(): Promise<MicrosoftSyncResult> {
  const ctx = await createSessionSyncContext();
  const connection = await getMicrosoftConnectionForUser(ctx);

  if (!connection) {
    throw new ValidationError("Microsoft account is not connected");
  }

  return syncMicrosoftForUser({
    ctx,
    connectionId: connection.id,
    trigger: "manual",
  });
}

export async function refreshMicrosoftCalendars(): Promise<void> {
  const ctx = await createSessionSyncContext();
  const connection = await getMicrosoftConnectionForUser(ctx);

  if (!connection?.encrypted_credentials) {
    throw new ValidationError("Microsoft account is not connected");
  }

  const session = createTokenCacheSession(connection);
  const { accessToken } = await acquireGraphAccessToken(session);
  await persistTokenCacheIfChanged(ctx, connection, session);
  await refreshMicrosoftCalendarsInternal(ctx, connection.id, accessToken);
}

export async function getMicrosoftConnectionStatus() {
  return getMicrosoftConnectionSafe();
}
