import { DatabaseError, ValidationError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { encryptCredential } from "@/lib/security/credential-encryption";
import type { SafeMicrosoftConnectionStatus } from "@/lib/integrations/microsoft/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionRow } from "@/types/domain";

const SAFE_CONNECTION_COLUMNS =
  "id, user_id, provider, display_name, status, requires_reauthentication, last_sync_attempt, last_successful_sync, last_sync_trigger, last_error, created_at, updated_at";

type SafeConnectionRow = Omit<
  ConnectionRow,
  "encrypted_credentials" | "external_tenant_id" | "external_home_account_id" | "credentials_version"
>;

function toSafeStatus(connection: SafeConnectionRow | null): SafeMicrosoftConnectionStatus {
  if (!connection) {
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

  return {
    isConfigured: true,
    displayLabel: connection.display_name,
    status: connection.status as SafeMicrosoftConnectionStatus["status"],
    requiresReauthentication: connection.requires_reauthentication ?? false,
    lastSyncAttempt: connection.last_sync_attempt,
    lastSuccessfulSync: connection.last_successful_sync,
    lastSyncTrigger:
      connection.last_sync_trigger as SafeMicrosoftConnectionStatus["lastSyncTrigger"],
    lastError: connection.last_error,
  };
}

export async function getMicrosoftConnectionSafe(): Promise<SafeMicrosoftConnectionStatus> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select(SAFE_CONNECTION_COLUMNS)
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Microsoft connection");
  }

  return toSafeStatus((data as SafeConnectionRow | null) ?? null);
}

export async function getMicrosoftConnectionWithCredentials(): Promise<ConnectionRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load Microsoft connection");
  }

  return data;
}

export type SaveMicrosoftConnectionInput = {
  serializedCache: string;
  displayLabel: string;
  tenantId: string | null;
  homeAccountId: string;
};

export async function saveMicrosoftConnection(
  input: SaveMicrosoftConnectionInput,
): Promise<SafeMicrosoftConnectionStatus> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const encryptedCredentials = encryptCredential(input.serializedCache);

  const { data: existing } = await supabase
    .from("connections")
    .select("id, credentials_version")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .maybeSingle();

  let connection: SafeConnectionRow;

  if (existing) {
    const { data, error } = await supabase
      .from("connections")
      .update({
        encrypted_credentials: encryptedCredentials,
        display_name: input.displayLabel,
        external_tenant_id: input.tenantId,
        external_home_account_id: input.homeAccountId,
        status: "connected",
        requires_reauthentication: false,
        last_error: null,
        credentials_version: (existing.credentials_version ?? 0) + 1,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select(SAFE_CONNECTION_COLUMNS)
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to update Microsoft connection");
    }

    connection = data as SafeConnectionRow;
  } else {
    const { data, error } = await supabase
      .from("connections")
      .insert({
        user_id: user.id,
        provider: "microsoft",
        display_name: input.displayLabel,
        encrypted_credentials: encryptedCredentials,
        external_tenant_id: input.tenantId,
        external_home_account_id: input.homeAccountId,
        status: "connected",
        requires_reauthentication: false,
        credentials_version: 1,
      })
      .select(SAFE_CONNECTION_COLUMNS)
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to create Microsoft connection");
    }

    connection = data as SafeConnectionRow;
  }

  return toSafeStatus(connection);
}

export async function disconnectMicrosoftConnection(): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: connection, error: connectionError } = await supabase
    .from("connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .maybeSingle();

  if (connectionError) {
    throw new DatabaseError("Failed to load Microsoft connection");
  }

  if (!connection) {
    return;
  }

  const { data: calendars, error: calendarsError } = await supabase
    .from("calendars")
    .select("id")
    .eq("user_id", user.id)
    .eq("connection_id", connection.id)
    .eq("source", "microsoft");

  if (calendarsError) {
    throw new DatabaseError("Failed to load Microsoft calendars");
  }

  const calendarIds = (calendars ?? []).map((calendar) => calendar.id);

  if (calendarIds.length > 0) {
    const { error: eventsError } = await supabase
      .from("events")
      .delete()
      .eq("user_id", user.id)
      .eq("source", "microsoft")
      .in("calendar_id", calendarIds);

    if (eventsError) {
      throw new DatabaseError("Failed to delete Microsoft events");
    }

    const { error: syncStateError } = await supabase
      .from("sync_states")
      .delete()
      .eq("user_id", user.id)
      .in("calendar_id", calendarIds);

    if (syncStateError) {
      throw new DatabaseError("Failed to delete Microsoft sync state");
    }

    const { error: deleteCalendarsError } = await supabase
      .from("calendars")
      .delete()
      .eq("user_id", user.id)
      .in("id", calendarIds);

    if (deleteCalendarsError) {
      throw new DatabaseError("Failed to delete Microsoft calendars");
    }
  }

  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "microsoft");

  if (error) {
    throw new DatabaseError("Failed to disconnect Microsoft connection");
  }
}

export async function assertMicrosoftConnectionReady(
  connection: ConnectionRow | null,
): Promise<ConnectionRow> {
  if (!connection) {
    throw new ValidationError("Microsoft account is not connected");
  }

  if (!connection.encrypted_credentials) {
    throw new ValidationError("Microsoft credentials are missing");
  }

  if (connection.requires_reauthentication) {
    throw new ValidationError("Microsoft account requires reconnection");
  }

  if (connection.status === "syncing") {
    throw new ValidationError("Microsoft synchronization is already in progress");
  }

  return connection;
}
