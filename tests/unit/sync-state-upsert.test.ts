import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { DatabaseError } from "@/lib/errors/app-error";
import { upsertSyncState } from "@/lib/integrations/canvas/sync-data";
import { upsertMicrosoftSyncState } from "@/lib/integrations/microsoft/sync-data";
import { SYNC_STATE_CALENDAR_CONFLICT_TARGET } from "@/lib/integrations/sync-state-persistence";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260712120000_fix_sync_states_calendar_unique_constraint.sql",
);

function createStrictSyncStateClient(options?: {
  upsertError?: { code: string; message: string; hint?: string | null } | null;
  row?: Record<string, unknown>;
}) {
  const upsert = vi.fn((payload, conflictOptions) => {
    if (conflictOptions?.onConflict !== SYNC_STATE_CALENDAR_CONFLICT_TARGET) {
      throw new Error(
        `Invalid onConflict target "${String(conflictOptions?.onConflict)}"; expected "${SYNC_STATE_CALENDAR_CONFLICT_TARGET}"`,
      );
    }

    if (!payload || typeof payload !== "object" || !("calendar_id" in payload)) {
      throw new Error("sync_states upsert must include calendar_id");
    }

    return {
      select: vi.fn(() => ({
        single: vi.fn(async () => {
          if (options?.upsertError) {
            return { data: null, error: options.upsertError };
          }

          return {
            data: options?.row ?? {
              id: "sync-state-1",
              user_id: "user-1",
              connection_id: "connection-1",
              calendar_id: payload.calendar_id,
              feed_hash: payload.feed_hash ?? null,
              last_seen_event_count: payload.last_seen_event_count ?? null,
              sync_cursor: payload.sync_cursor ?? null,
              last_full_sync_at: payload.last_full_sync_at ?? null,
              sync_window_start: payload.sync_window_start ?? null,
              sync_window_end: payload.sync_window_end ?? null,
              last_synced_at: payload.last_synced_at ?? null,
              created_at: "2026-07-11T00:00:00.000Z",
              updated_at: "2026-07-11T00:00:00.000Z",
            },
            error: null,
          };
        }),
      })),
    };
  });

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table !== "sync_states") {
          throw new Error(`Unexpected table "${table}"`);
        }

        return { upsert };
      }),
    } as never,
    upsert,
  };
}

describe("sync state upsert conflict target", () => {
  it("migration adds a non-partial unique constraint on calendar_id", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toContain("DROP INDEX IF EXISTS public.sync_states_calendar_id_unique");
    expect(sql).toContain("DROP INDEX IF EXISTS public.sync_states_connection_id_unique");
    expect(sql).toContain(
      "ADD CONSTRAINT sync_states_calendar_id_key UNIQUE (calendar_id)",
    );
    expect(sql).not.toMatch(/unique\s*\(\s*connection_id\s*,\s*calendar_id\s*\)/i);
  });

  it("canvas upsertSyncState uses calendar_id onConflict", async () => {
    const { client, upsert } = createStrictSyncStateClient();

    const result = await upsertSyncState(
      { client, userId: "user-1" },
      {
        connectionId: "connection-1",
        calendarId: "calendar-1",
        feedHash: "hash-1",
        lastSeenEventCount: 3,
        syncWindowStart: "2026-07-01T00:00:00.000Z",
        syncWindowEnd: "2026-08-01T00:00:00.000Z",
      },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        connection_id: "connection-1",
        calendar_id: "calendar-1",
        feed_hash: "hash-1",
      }),
      { onConflict: "calendar_id" },
    );
    expect(result.calendar_id).toBe("calendar-1");
  });

  it("microsoft upsertMicrosoftSyncState uses calendar_id onConflict", async () => {
    const { client, upsert } = createStrictSyncStateClient();

    const result = await upsertMicrosoftSyncState(
      { client, userId: "user-1" },
      {
        connectionId: "connection-1",
        calendarId: "calendar-1",
        syncCursor: "cursor-1",
        syncWindowStart: "2026-07-01T00:00:00.000Z",
        syncWindowEnd: "2026-08-01T00:00:00.000Z",
        isFullSync: true,
      },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        connection_id: "connection-1",
        calendar_id: "calendar-1",
        sync_cursor: "cursor-1",
        last_full_sync_at: expect.any(String),
      }),
      { onConflict: "calendar_id" },
    );
    expect(result.calendar_id).toBe("calendar-1");
  });

  it("canvas upsert surfaces sanitized database constraint mismatch errors", async () => {
    const { client } = createStrictSyncStateClient({
      upsertError: {
        code: "42P10",
        message:
          "there is no unique or exclusion constraint matching the ON CONFLICT specification",
      },
    });

    await expect(
      upsertSyncState(
        { client, userId: "user-1" },
        {
          connectionId: "connection-1",
          calendarId: "calendar-1",
          feedHash: "hash-1",
          lastSeenEventCount: 1,
          syncWindowStart: null,
          syncWindowEnd: null,
        },
      ),
    ).rejects.toMatchObject({
      name: "DatabaseError",
      message: "Failed to update sync state: database constraint mismatch (42P10)",
    } satisfies Partial<DatabaseError>);
  });
});
