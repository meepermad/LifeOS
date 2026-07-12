import { describe, expect, it } from "vitest";
import {
  buildSyncStatePersistenceError,
  SYNC_STATE_CALENDAR_CONFLICT_TARGET,
} from "@/lib/integrations/sync-state-persistence";

describe("sync state persistence errors", () => {
  it("exposes the calendar_id conflict target used by upserts", () => {
    expect(SYNC_STATE_CALENDAR_CONFLICT_TARGET).toBe("calendar_id");
  });

  it("maps PostgREST 42P10 to a constraint mismatch message", () => {
    expect(
      buildSyncStatePersistenceError("canvas", {
        code: "42P10",
        message:
          "there is no unique or exclusion constraint matching the ON CONFLICT specification",
        hint: null,
      }),
    ).toBe("Failed to update sync state: database constraint mismatch (42P10)");
  });

  it("includes sanitized database code and message for other errors", () => {
    expect(
      buildSyncStatePersistenceError("microsoft", {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        hint: "Key (calendar_id)=(cal-1) already exists.",
      }),
    ).toBe(
      "Failed to update sync state: duplicate key value violates unique constraint (23505)",
    );
  });

  it("redacts URLs and bearer tokens from database messages", () => {
    const message = buildSyncStatePersistenceError("canvas", {
      code: "XX000",
      message: "fetch failed for https://canvas.example.edu/feed.ics Bearer secret-token",
      hint: null,
    });

    expect(message).not.toContain("https://canvas.example.edu");
    expect(message).not.toContain("secret-token");
    expect(message).toContain("[url]");
    expect(message).toContain("[token]");
  });

  it("handles missing error details safely", () => {
    expect(buildSyncStatePersistenceError("canvas", null)).toBe(
      "Failed to update sync state: unknown database error",
    );
  });
});
