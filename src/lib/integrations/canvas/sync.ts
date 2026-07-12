import { AppError, ValidationError } from "@/lib/errors/app-error";
import { decryptCredential } from "@/lib/security/credential-encryption";
import { fetchCanvasFeed } from "@/lib/integrations/canvas/fetch-feed";
import {
  computeFeedHash,
  computeSyncWindow,
  shouldReconcileRemovals,
} from "@/lib/integrations/canvas/normalize";
import { parseCanvasFeed } from "@/lib/integrations/canvas/parse-feed";
import type { CanvasSyncResult } from "@/lib/integrations/canvas/schemas";
import {
  reconcileCancelledCanvasTasks,
  reconcileReclassifiedCanvasTasks,
  syncCanvasTasksForDeadlineEvents,
} from "@/lib/integrations/canvas/task-sync";
import {
  createSessionSyncContext,
  type CanvasSyncContext,
  type CanvasSyncTrigger,
} from "@/lib/integrations/canvas/sync-context";
import {
  cancelCanvasEventsNotInSet,
  claimConnectionForSync,
  getCanvasCalendarForUser,
  getConnectionWithCredentials,
  getSyncStateForConnection,
  listCanvasEventsByExternalIds,
  markConnectionSyncError,
  markConnectionSyncSuccess,
  upsertCanvasEvent,
  upsertSyncState,
} from "@/lib/integrations/canvas/sync-data";
import { getCanvasConnectionWithCredentials } from "@/lib/data/connections";

function toSafeSyncError(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  return "Canvas synchronization failed";
}

export async function syncCanvasForUser(input: {
  ctx: CanvasSyncContext;
  connectionId: string;
  trigger: CanvasSyncTrigger;
}): Promise<CanvasSyncResult> {
  const { ctx, connectionId, trigger } = input;

  await getConnectionWithCredentials(ctx, connectionId);

  const claimResult = await claimConnectionForSync(ctx, connectionId);
  if (claimResult === "already_running") {
    throw new ValidationError("Canvas synchronization is already in progress");
  }
  if (claimResult === "not_found") {
    throw new ValidationError("Canvas feed is not configured");
  }
  if (claimResult === "not_connected") {
    throw new ValidationError("Canvas connection is not ready for synchronization");
  }

  try {
    const connection = await getConnectionWithCredentials(ctx, connectionId);
    const canvasCalendar = await getCanvasCalendarForUser(ctx);
    const syncState = await getSyncStateForConnection(ctx, connectionId);
    const feedUrl = decryptCredential(connection.encrypted_credentials!);
    const { body } = await fetchCanvasFeed(feedUrl);
    const feedHash = computeFeedHash(body);
    const parsed = parseCanvasFeed(body);

    const eventCounts = {
      created: 0,
      updated: 0,
      unchanged: 0,
      cancelled: 0,
      warnings: parsed.warnings,
    };

    const seenExternalIds: string[] = [];

    for (const event of parsed.events) {
      const result = await upsertCanvasEvent(ctx, canvasCalendar.id, event);
      seenExternalIds.push(event.externalEventId);
      eventCounts[result] += 1;
    }

    const window = computeSyncWindow(parsed.events);
    const feedTrustworthy =
      shouldReconcileRemovals({
        parsedEventCount: parsed.events.length,
        previousEventCount: syncState?.last_seen_event_count ?? null,
        warnings: parsed.warnings,
      }) &&
      window.start != null &&
      window.end != null;

    let reconciledEventIds: string[] = [];

    if (feedTrustworthy) {
      const reconciliation = await cancelCanvasEventsNotInSet(ctx, {
        calendarId: canvasCalendar.id,
        seenExternalIds,
        windowStart: window.start!,
        windowEnd: window.end!,
      });
      eventCounts.cancelled = reconciliation.count;
      reconciledEventIds = reconciliation.eventIds;
    }

    const reclassifiedCancellations = await reconcileReclassifiedCanvasTasks(ctx, {
      parsedEvents: parsed.events,
      feedTrustworthy,
    });

    const deadlineExternalIds = parsed.events
      .filter((event) => event.eventType === "deadline")
      .map((event) => event.externalEventId);

    const deadlineEvents = await listCanvasEventsByExternalIds(
      ctx,
      canvasCalendar.id,
      deadlineExternalIds,
    );

    const taskCounts = await syncCanvasTasksForDeadlineEvents(ctx, deadlineEvents);

    const reconciledRemovalCancellations = await reconcileCancelledCanvasTasks(ctx, {
      cancelledEventIds: reconciledEventIds,
      removalReconciliationRan: feedTrustworthy,
    });

    taskCounts.cancelled += reclassifiedCancellations + reconciledRemovalCancellations;

    await upsertSyncState(ctx, {
      connectionId: connection.id,
      calendarId: canvasCalendar.id,
      feedHash,
      lastSeenEventCount: parsed.events.length,
      syncWindowStart: window.start,
      syncWindowEnd: window.end,
    });

    await markConnectionSyncSuccess(ctx, connectionId, trigger);
    return {
      events: eventCounts,
      tasks: taskCounts,
      warnings: parsed.warnings,
    };
  } catch (error) {
    await markConnectionSyncError(ctx, connectionId, toSafeSyncError(error));
    throw error;
  }
}

export async function syncCanvasCalendar(): Promise<CanvasSyncResult> {
  const ctx = await createSessionSyncContext();
  const connection = await getCanvasConnectionWithCredentials();

  if (!connection) {
    throw new ValidationError("Canvas feed is not configured");
  }

  return syncCanvasForUser({
    ctx,
    connectionId: connection.id,
    trigger: "manual",
  });
}
