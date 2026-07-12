import {
  ConflictError,
  DatabaseError,
  ValidationError,
} from "@/lib/errors/app-error";
import type { MicrosoftSyncContext, MicrosoftSyncTrigger } from "@/lib/integrations/microsoft/sync-context";
import type { NormalizedMicrosoftEvent } from "@/lib/integrations/microsoft/schemas";
import type { ConnectionRow, CalendarRow, SyncStateRow } from "@/types/domain";
import type { Database } from "@/types/database.types";

export type ConnectionClaimResult =
  | "claimed"
  | "already_running"
  | "not_found"
  | "not_connected";

export async function claimConnectionForSync(
  ctx: MicrosoftSyncContext,
  connectionId: string,
  staleMinutes = 15,
): Promise<ConnectionClaimResult> {
  const { data, error } = await ctx.client.rpc("claim_connection_for_sync", {
    p_connection_id: connectionId,
    p_stale_minutes: staleMinutes,
  });

  if (error) {
    throw new DatabaseError("Failed to claim Microsoft connection for sync");
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

export async function getMicrosoftConnectionWithCredentials(
  ctx: MicrosoftSyncContext,
  connectionId: string,
): Promise<ConnectionRow> {
  const { data, error } = await ctx.client
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", ctx.userId)
    .eq("provider", "microsoft")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Microsoft connection");
  }

  if (!data) {
    throw new ValidationError("Microsoft account is not connected");
  }

  if (!data.encrypted_credentials) {
    throw new ValidationError("Microsoft credentials are missing");
  }

  return data;
}

export async function markConnectionSyncSuccess(
  ctx: MicrosoftSyncContext,
  connectionId: string,
  trigger: MicrosoftSyncTrigger,
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
    throw new DatabaseError("Failed to update Microsoft connection status");
  }
}

export async function markConnectionSyncError(
  ctx: MicrosoftSyncContext,
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
    throw new DatabaseError("Failed to update Microsoft connection error");
  }
}

export async function listEnabledMicrosoftCalendars(
  ctx: MicrosoftSyncContext,
  connectionId: string,
): Promise<CalendarRow[]> {
  const { data, error } = await ctx.client
    .from("calendars")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("connection_id", connectionId)
    .eq("source", "microsoft")
    .eq("sync_enabled", true)
    .not("external_calendar_id", "is", null);

  if (error) {
    throw new DatabaseError("Failed to load enabled Microsoft calendars");
  }

  return data ?? [];
}

export async function getSyncStateForCalendar(
  ctx: MicrosoftSyncContext,
  calendarId: string,
): Promise<SyncStateRow | null> {
  const { data, error } = await ctx.client
    .from("sync_states")
    .select("*")
    .eq("calendar_id", calendarId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Microsoft sync state");
  }

  return data;
}

export async function upsertMicrosoftSyncState(
  ctx: MicrosoftSyncContext,
  input: {
    connectionId: string;
    calendarId: string;
    syncCursor: string;
    syncWindowStart: string;
    syncWindowEnd: string;
    isFullSync: boolean;
  },
): Promise<SyncStateRow> {
  const now = new Date().toISOString();

  const payload: Database["public"]["Tables"]["sync_states"]["Insert"] = {
    user_id: ctx.userId,
    connection_id: input.connectionId,
    calendar_id: input.calendarId,
    sync_cursor: input.syncCursor,
    sync_window_start: input.syncWindowStart,
    sync_window_end: input.syncWindowEnd,
    last_synced_at: now,
  };

  if (input.isFullSync) {
    payload.last_full_sync_at = now;
  }

  const { data, error } = await ctx.client
    .from("sync_states")
    .upsert(payload, { onConflict: "calendar_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update Microsoft sync state");
  }

  return data;
}

export async function clearMicrosoftSyncCursor(
  ctx: MicrosoftSyncContext,
  calendarId: string,
): Promise<void> {
  const { error } = await ctx.client
    .from("sync_states")
    .update({ sync_cursor: null })
    .eq("calendar_id", calendarId)
    .eq("user_id", ctx.userId);

  if (error) {
    throw new DatabaseError("Failed to clear Microsoft sync cursor");
  }
}

export type MicrosoftUpsertResult = "created" | "updated" | "unchanged" | "cancelled";

export async function upsertMicrosoftEvent(
  ctx: MicrosoftSyncContext,
  calendarId: string,
  event: NormalizedMicrosoftEvent,
): Promise<MicrosoftUpsertResult> {
  const { data: calendar, error: calendarError } = await ctx.client
    .from("calendars")
    .select("id, source, user_id")
    .eq("id", calendarId)
    .eq("user_id", ctx.userId)
    .single();

  if (calendarError || !calendar) {
    throw new DatabaseError("Microsoft calendar not found");
  }

  if (calendar.source !== "microsoft") {
    throw new ConflictError("Microsoft events may only be written to Microsoft calendars");
  }

  const { data: existing, error: existingError } = await ctx.client
    .from("events")
    .select("*")
    .eq("calendar_id", calendarId)
    .eq("external_event_id", event.externalEventId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (existingError) {
    throw new DatabaseError("Failed to load existing Microsoft event");
  }

  if (event.isRemoved) {
    if (!existing) {
      return "unchanged";
    }

    if (existing.status === "cancelled") {
      return "unchanged";
    }

    const { error } = await ctx.client
      .from("events")
      .update({ status: "cancelled", blocks_time: false })
      .eq("id", existing.id)
      .eq("user_id", ctx.userId);

    if (error) {
      throw new DatabaseError("Failed to cancel removed Microsoft event");
    }

    return "cancelled";
  }

  const payload = {
    user_id: ctx.userId,
    calendar_id: calendarId,
    external_event_id: event.externalEventId,
    title: event.title,
    description: null,
    location: event.location,
    start_at: event.startAt,
    end_at: event.endAt,
    all_day: event.allDay,
    status: event.status,
    source: "microsoft" as const,
    event_type: event.eventType,
    is_read_only: true,
    blocks_time: event.blocksTime,
    created_by_assistant: false,
    external_updated_at: event.externalUpdatedAt,
    content_hash: event.contentHash,
    external_change_key: event.externalChangeKey,
    show_as: event.showAs,
    sensitivity: event.sensitivity,
    organizer_name: event.organizerName,
    online_meeting_url: event.onlineMeetingUrl,
  };

  if (!existing) {
    const { error } = await ctx.client.from("events").insert(payload);
    if (error) {
      throw new DatabaseError("Failed to create Microsoft event");
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
    throw new DatabaseError("Failed to update Microsoft event");
  }

  return "updated";
}

export async function listConnectedMicrosoftConnections(
  ctx: MicrosoftSyncContext,
): Promise<Array<{ id: string; user_id: string }>> {
  const { data, error } = await ctx.client
    .from("connections")
    .select("id, user_id")
    .eq("provider", "microsoft")
    .in("status", ["connected", "error"])
    .eq("requires_reauthentication", false)
    .not("encrypted_credentials", "is", null);

  if (error) {
    throw new DatabaseError("Failed to load Microsoft connections for scheduled sync");
  }

  return data ?? [];
}

export async function getMicrosoftConnectionForUser(
  ctx: MicrosoftSyncContext,
): Promise<ConnectionRow | null> {
  const { data, error } = await ctx.client
    .from("connections")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("provider", "microsoft")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Microsoft connection");
  }

  return data;
}
