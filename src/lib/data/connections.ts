import { DatabaseError, ValidationError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { encryptCredential } from "@/lib/security/credential-encryption";
import { validateCanvasFeedUrl } from "@/lib/integrations/canvas/url-validation";
import type { SafeCanvasConnectionStatus } from "@/lib/integrations/canvas/schemas";
import { getCanvasCalendar, linkCalendarToConnection } from "@/lib/data/calendars";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionRow } from "@/types/domain";

const SAFE_CONNECTION_COLUMNS =
  "id, user_id, provider, display_name, status, last_sync_attempt, last_successful_sync, last_sync_trigger, last_error, created_at, updated_at";

type SafeConnectionRow = Omit<ConnectionRow, "encrypted_credentials">;

function toSafeStatus(connection: SafeConnectionRow | null): SafeCanvasConnectionStatus {
  if (!connection) {
    return {
      isConfigured: false,
      displayLabel: null,
      status: "disconnected",
      lastSyncAttempt: null,
      lastSuccessfulSync: null,
      lastSyncTrigger: null,
      lastError: null,
    };
  }

  return {
    isConfigured: true,
    displayLabel: "Canvas feed configured",
    status: connection.status as SafeCanvasConnectionStatus["status"],
    lastSyncAttempt: connection.last_sync_attempt,
    lastSuccessfulSync: connection.last_successful_sync,
    lastSyncTrigger: connection.last_sync_trigger as SafeCanvasConnectionStatus["lastSyncTrigger"],
    lastError: connection.last_error,
  };
}

export async function getCanvasConnectionSafe(): Promise<SafeCanvasConnectionStatus> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select(SAFE_CONNECTION_COLUMNS)
    .eq("user_id", user.id)
    .eq("provider", "canvas_ics")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Canvas connection");
  }

  return toSafeStatus((data as SafeConnectionRow | null) ?? null);
}

export async function getCanvasConnectionWithCredentials(): Promise<ConnectionRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "canvas_ics")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Canvas connection");
  }

  return data;
}

export async function saveCanvasFeedUrl(url: string): Promise<SafeCanvasConnectionStatus> {
  const user = await requireAllowedUser();
  validateCanvasFeedUrl(url);

  const encryptedCredentials = encryptCredential(url);
  const supabase = await createClient();
  const canvasCalendar = await getCanvasCalendar();

  const { data: existing } = await supabase
    .from("connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "canvas_ics")
    .maybeSingle();

  let connection: SafeConnectionRow;

  if (existing) {
    const { data, error } = await supabase
      .from("connections")
      .update({
        encrypted_credentials: encryptedCredentials,
        display_name: "Canvas ICS",
        status: "connected",
        last_error: null,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select(SAFE_CONNECTION_COLUMNS)
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to update Canvas connection");
    }

    connection = data as SafeConnectionRow;
  } else {
    const { data, error } = await supabase
      .from("connections")
      .insert({
        user_id: user.id,
        provider: "canvas_ics",
        display_name: "Canvas ICS",
        encrypted_credentials: encryptedCredentials,
        status: "connected",
      })
      .select(SAFE_CONNECTION_COLUMNS)
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to create Canvas connection");
    }

    connection = data as SafeConnectionRow;
  }

  await linkCalendarToConnection(canvasCalendar.id, connection.id);
  return toSafeStatus(connection);
}

export async function disconnectCanvasConnection(): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const canvasCalendar = await getCanvasCalendar();

  const { error: calendarError } = await supabase
    .from("calendars")
    .update({ connection_id: null })
    .eq("id", canvasCalendar.id)
    .eq("user_id", user.id);

  if (calendarError) {
    throw new DatabaseError("Failed to unlink Canvas calendar");
  }

  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "canvas_ics");

  if (error) {
    throw new DatabaseError("Failed to disconnect Canvas connection");
  }
}

export async function markConnectionSyncing(connectionId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("connections")
    .update({
      status: "syncing",
      last_sync_attempt: now,
    })
    .eq("id", connectionId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to mark Canvas connection as syncing");
  }
}

export async function markConnectionSyncSuccess(connectionId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("connections")
    .update({
      status: "connected",
      last_successful_sync: now,
      last_error: null,
    })
    .eq("id", connectionId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to update Canvas connection status");
  }
}

export async function markConnectionSyncError(
  connectionId: string,
  message: string,
): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("connections")
    .update({
      status: "error",
      last_error: message,
    })
    .eq("id", connectionId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to update Canvas connection error");
  }
}

export async function resetConnectionIfSyncing(connectionId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select("status")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Canvas connection status");
  }

  if (data?.status === "syncing") {
    await markConnectionSyncError(
      connectionId,
      "Previous synchronization did not complete",
    );
  }
}

export async function assertCanvasConnectionReady(
  connection: ConnectionRow | null,
): Promise<ConnectionRow> {
  if (!connection) {
    throw new ValidationError("Canvas feed is not configured");
  }

  if (!connection.encrypted_credentials) {
    throw new ValidationError("Canvas feed credentials are missing");
  }

  if (connection.status === "syncing") {
    throw new ValidationError("Canvas synchronization is already in progress");
  }

  return connection;
}
