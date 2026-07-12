import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { SyncStateRow } from "@/types/domain";

export async function getSyncStateForConnection(
  connectionId: string,
): Promise<SyncStateRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sync_states")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load sync state");
  }

  return data;
}

export async function upsertSyncState(input: {
  connectionId: string;
  calendarId: string;
  feedHash: string;
  lastSeenEventCount: number;
  syncWindowStart: string | null;
  syncWindowEnd: string | null;
}): Promise<SyncStateRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("sync_states")
    .upsert(
      {
        user_id: user.id,
        connection_id: input.connectionId,
        calendar_id: input.calendarId,
        feed_hash: input.feedHash,
        last_seen_event_count: input.lastSeenEventCount,
        sync_window_start: input.syncWindowStart,
        sync_window_end: input.syncWindowEnd,
        last_synced_at: now,
      },
      { onConflict: "connection_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update sync state");
  }

  return data;
}
