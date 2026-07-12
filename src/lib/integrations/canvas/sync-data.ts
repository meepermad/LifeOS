import {
  ConflictError,
  DatabaseError,
  ValidationError,
} from "@/lib/errors/app-error";
import {
  buildSyncStatePersistenceError,
  logSyncStateDatabaseError,
  SYNC_STATE_CALENDAR_CONFLICT_TARGET,
} from "@/lib/integrations/sync-state-persistence";
import type { CanvasSyncContext, CanvasSyncTrigger } from "@/lib/integrations/canvas/sync-context";
import type { NormalizedCanvasEvent } from "@/lib/integrations/canvas/schemas";
import { defaultBlocksTimeForEventType } from "@/lib/planning/mappers";
import type { ConnectionRow, SyncStateRow, CalendarRow, TaskRow } from "@/types/domain";
import type { TaskStatus } from "@/types/domain";

export type ConnectionClaimResult =
  | "claimed"
  | "already_running"
  | "not_found"
  | "not_connected";

export async function claimConnectionForSync(
  ctx: CanvasSyncContext,
  connectionId: string,
  staleMinutes = 15,
): Promise<ConnectionClaimResult> {
  const { data, error } = await ctx.client.rpc("claim_connection_for_sync", {
    p_connection_id: connectionId,
    p_stale_minutes: staleMinutes,
  });

  if (error) {
    throw new DatabaseError("Failed to claim Canvas connection for sync");
  }

  const result = data as string;
  if (
    result === "claimed" ||
    result === "already_running" ||
    result === "not_found" ||
    result === "not_connected"
  ) {
    return result;
  }

  throw new DatabaseError("Unexpected claim result from sync RPC");
}

export async function getConnectionWithCredentials(
  ctx: CanvasSyncContext,
  connectionId: string,
): Promise<ConnectionRow> {
  const { data, error } = await ctx.client
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", ctx.userId)
    .eq("provider", "canvas_ics")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Canvas connection");
  }

  if (!data) {
    throw new ValidationError("Canvas feed is not configured");
  }

  if (!data.encrypted_credentials) {
    throw new ValidationError("Canvas feed credentials are missing");
  }

  return data;
}

export async function markConnectionSyncSuccess(
  ctx: CanvasSyncContext,
  connectionId: string,
  trigger: CanvasSyncTrigger,
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await ctx.client
    .from("connections")
    .update({
      status: "connected",
      last_successful_sync: now,
      last_sync_trigger: trigger,
      last_error: null,
    })
    .eq("id", connectionId)
    .eq("user_id", ctx.userId);

  if (error) {
    throw new DatabaseError("Failed to update Canvas connection status");
  }
}

export async function markConnectionSyncError(
  ctx: CanvasSyncContext,
  connectionId: string,
  message: string,
): Promise<void> {
  const { error } = await ctx.client
    .from("connections")
    .update({
      status: "error",
      last_error: message,
    })
    .eq("id", connectionId)
    .eq("user_id", ctx.userId);

  if (error) {
    throw new DatabaseError("Failed to update Canvas connection error");
  }
}

export async function getCanvasCalendarForUser(
  ctx: CanvasSyncContext,
): Promise<CalendarRow> {
  const { data, error } = await ctx.client
    .from("calendars")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("source", "canvas")
    .eq("name", "Canvas")
    .single();

  if (error || !data) {
    throw new DatabaseError("Canvas calendar not found");
  }

  return data;
}

export async function getSyncStateForConnection(
  ctx: CanvasSyncContext,
  connectionId: string,
): Promise<SyncStateRow | null> {
  const { data, error } = await ctx.client
    .from("sync_states")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load sync state");
  }

  return data;
}

export async function upsertSyncState(
  ctx: CanvasSyncContext,
  input: {
    connectionId: string;
    calendarId: string;
    feedHash: string;
    lastSeenEventCount: number;
    syncWindowStart: string | null;
    syncWindowEnd: string | null;
  },
): Promise<SyncStateRow> {
  const now = new Date().toISOString();

  const { data, error } = await ctx.client
    .from("sync_states")
    .upsert(
      {
        user_id: ctx.userId,
        connection_id: input.connectionId,
        calendar_id: input.calendarId,
        feed_hash: input.feedHash,
        last_seen_event_count: input.lastSeenEventCount,
        sync_window_start: input.syncWindowStart,
        sync_window_end: input.syncWindowEnd,
        last_synced_at: now,
      },
      { onConflict: SYNC_STATE_CALENDAR_CONFLICT_TARGET },
    )
    .select("*")
    .single();

  if (error || !data) {
    logSyncStateDatabaseError("canvas", error);
    throw new DatabaseError(buildSyncStatePersistenceError("canvas", error));
  }

  return data;
}

export type CanvasUpsertResult = "created" | "updated" | "unchanged";

export async function upsertCanvasEvent(
  ctx: CanvasSyncContext,
  calendarId: string,
  event: NormalizedCanvasEvent,
): Promise<CanvasUpsertResult> {
  const { data: calendar, error: calendarError } = await ctx.client
    .from("calendars")
    .select("id, source, user_id")
    .eq("id", calendarId)
    .eq("user_id", ctx.userId)
    .single();

  if (calendarError || !calendar) {
    throw new DatabaseError("Canvas calendar not found");
  }

  if (calendar.source !== "canvas") {
    throw new ConflictError("Canvas events may only be written to the Canvas calendar");
  }

  const { data: existing, error: existingError } = await ctx.client
    .from("events")
    .select("*")
    .eq("calendar_id", calendarId)
    .eq("external_event_id", event.externalEventId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (existingError) {
    throw new DatabaseError("Failed to load existing Canvas event");
  }

  const payload = {
    user_id: ctx.userId,
    calendar_id: calendarId,
    external_event_id: event.externalEventId,
    title: event.title,
    description: event.description,
    location: event.location,
    start_at: event.startAt,
    end_at: event.endAt,
    all_day: event.allDay,
    status: event.status,
    source: "canvas" as const,
    event_type: event.eventType,
    is_read_only: true,
    blocks_time: defaultBlocksTimeForEventType(event.eventType),
    created_by_assistant: false,
    external_updated_at: event.externalUpdatedAt,
    content_hash: event.contentHash,
  };

  if (!existing) {
    const { error } = await ctx.client.from("events").insert(payload);
    if (error) {
      throw new DatabaseError("Failed to create Canvas event");
    }
    return "created";
  }

  if (existing.content_hash === event.contentHash) {
    return "unchanged";
  }

  const { error } = await ctx.client
    .from("events")
    .update(payload)
    .eq("id", existing.id)
    .eq("user_id", ctx.userId);

  if (error) {
    throw new DatabaseError("Failed to update Canvas event");
  }

  return "updated";
}

export async function cancelCanvasEventsNotInSet(
  ctx: CanvasSyncContext,
  input: {
    calendarId: string;
    seenExternalIds: string[];
    windowStart: string;
    windowEnd: string;
  },
): Promise<{ count: number; eventIds: string[] }> {
  const { data: events, error } = await ctx.client
    .from("events")
    .select("id, external_event_id, status, event_type")
    .eq("user_id", ctx.userId)
    .eq("calendar_id", input.calendarId)
    .eq("source", "canvas")
    .gte("start_at", input.windowStart)
    .lte("start_at", input.windowEnd)
    .not("external_event_id", "is", null);

  if (error) {
    throw new DatabaseError("Failed to load Canvas events for reconciliation");
  }

  const seen = new Set(input.seenExternalIds);
  const toCancel = (events ?? []).filter(
    (event) =>
      event.external_event_id &&
      !seen.has(event.external_event_id) &&
      event.status !== "cancelled",
  );

  if (toCancel.length === 0) {
    return { count: 0, eventIds: [] };
  }

  const eventIds = toCancel.map((event) => event.id);

  const { error: updateError } = await ctx.client
    .from("events")
    .update({ status: "cancelled" })
    .in("id", eventIds)
    .eq("user_id", ctx.userId);

  if (updateError) {
    throw new DatabaseError("Failed to cancel removed Canvas events");
  }

  const deadlineEventIds = toCancel
    .filter((event) => event.event_type === "deadline")
    .map((event) => event.id);

  return { count: toCancel.length, eventIds: deadlineEventIds };
}

export type CanvasEventForSync = {
  id: string;
  external_event_id: string;
  title: string;
  description: string | null;
  end_at: string;
  status: string;
  event_type: string;
};

export async function listCanvasEventsByExternalIds(
  ctx: CanvasSyncContext,
  calendarId: string,
  externalIds: string[],
): Promise<CanvasEventForSync[]> {
  if (externalIds.length === 0) {
    return [];
  }

  const { data, error } = await ctx.client
    .from("events")
    .select("id, external_event_id, title, description, end_at, status, event_type")
    .eq("user_id", ctx.userId)
    .eq("calendar_id", calendarId)
    .eq("source", "canvas")
    .in("external_event_id", externalIds);

  if (error) {
    throw new DatabaseError("Failed to load Canvas events for task sync");
  }

  return (data ?? []).filter(
    (event): event is CanvasEventForSync =>
      event.external_event_id != null && event.event_type === "deadline",
  );
}

export type CanvasTaskForSync = TaskRow;

export async function listCanvasTasksForSync(
  ctx: CanvasSyncContext,
  externalTaskIds: string[],
): Promise<CanvasTaskForSync[]> {
  if (externalTaskIds.length === 0) {
    return [];
  }

  const { data, error } = await ctx.client
    .from("tasks")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("source", "canvas")
    .in("external_task_id", externalTaskIds);

  if (error) {
    throw new DatabaseError("Failed to load Canvas tasks for sync");
  }

  return data ?? [];
}

export async function listCanvasTasksByRelatedEventIds(
  ctx: CanvasSyncContext,
  eventIds: string[],
): Promise<CanvasTaskForSync[]> {
  if (eventIds.length === 0) {
    return [];
  }

  const { data, error } = await ctx.client
    .from("tasks")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("source", "canvas")
    .in("related_event_id", eventIds);

  if (error) {
    throw new DatabaseError("Failed to load Canvas tasks by related event");
  }

  return data ?? [];
}

export type CanvasTaskSyncInsert = {
  user_id: string;
  title: string;
  description: string | null;
  source: "canvas";
  external_task_id: string;
  due_at: string;
  estimated_minutes: null;
  remaining_minutes: null;
  priority: number;
  difficulty: number;
  status: "open" | "cancelled";
  splittable: boolean;
  minimum_block_minutes: number;
  related_event_id: string;
  sync_managed: boolean;
  cancelled_by_sync: boolean;
  source_content_hash: string;
};

export type CanvasTaskSyncUpdate = {
  id: string;
  title: string;
  description: string | null;
  external_task_id: string;
  due_at: string;
  related_event_id: string;
  source_content_hash: string;
  sync_managed: boolean;
  status?: TaskStatus;
  cancelled_by_sync?: boolean;
};

export async function batchInsertCanvasTasks(
  ctx: CanvasSyncContext,
  rows: CanvasTaskSyncInsert[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await ctx.client.from("tasks").insert(
    rows.map((row) => ({
      ...row,
      user_id: ctx.userId,
    })),
  );

  if (error) {
    throw new DatabaseError("Failed to batch insert Canvas tasks");
  }
}

export async function batchUpdateCanvasTasks(
  ctx: CanvasSyncContext,
  rows: CanvasTaskSyncUpdate[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await Promise.all(
    rows.map(async (row) => {
      const { id, ...payload } = row;
      const { error } = await ctx.client
        .from("tasks")
        .update(payload)
        .eq("id", id)
        .eq("user_id", ctx.userId);

      if (error) {
        throw new DatabaseError("Failed to batch update Canvas tasks");
      }
    }),
  );
}

export async function cancelSyncManagedTasksForEvents(
  ctx: CanvasSyncContext,
  eventIds: string[],
): Promise<number> {
  if (eventIds.length === 0) {
    return 0;
  }

  const { data: tasks, error } = await ctx.client
    .from("tasks")
    .select("id, status")
    .eq("user_id", ctx.userId)
    .eq("source", "canvas")
    .eq("sync_managed", true)
    .in("related_event_id", eventIds)
    .in("status", ["open", "in_progress", "deferred"]);

  if (error) {
    throw new DatabaseError("Failed to load tasks for cancellation");
  }

  const toCancel = (tasks ?? []).filter((task) => task.status !== "completed");
  if (toCancel.length === 0) {
    return 0;
  }

  const { error: updateError } = await ctx.client
    .from("tasks")
    .update({ status: "cancelled", cancelled_by_sync: true })
    .in(
      "id",
      toCancel.map((task) => task.id),
    )
    .eq("user_id", ctx.userId);

  if (updateError) {
    throw new DatabaseError("Failed to cancel sync-managed Canvas tasks");
  }

  return toCancel.length;
}

export async function listConnectedCanvasConnections(
  ctx: CanvasSyncContext,
): Promise<Array<{ id: string; user_id: string }>> {
  const { data, error } = await ctx.client
    .from("connections")
    .select("id, user_id")
    .eq("provider", "canvas_ics")
    .in("status", ["connected", "error"])
    .not("encrypted_credentials", "is", null);

  if (error) {
    throw new DatabaseError("Failed to load Canvas connections for scheduled sync");
  }

  return data ?? [];
}
