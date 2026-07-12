import { describe, expect, it } from "vitest";
import {
  normalizeMicrosoftEvent,
  normalizeMicrosoftEvents,
  shouldResetSyncWindow,
} from "@/lib/integrations/microsoft/normalize";
import type { GraphEvent } from "@/lib/integrations/microsoft/schemas";

describe("microsoft normalize", () => {
  it("maps timed events with blocking behavior", () => {
    const event: GraphEvent = {
      id: "event-1",
      subject: "Team sync",
      start: { dateTime: "2026-07-15T14:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-07-15T15:00:00.0000000", timeZone: "UTC" },
      isAllDay: false,
      showAs: "busy",
      isCancelled: false,
    };

    const normalized = normalizeMicrosoftEvent(event);
    expect(normalized?.status).toBe("confirmed");
    expect(normalized?.blocksTime).toBe(true);
    expect(normalized?.eventType).toBe("meeting");
  });

  it("maps all-day events", () => {
    const event: GraphEvent = {
      id: "event-2",
      subject: "Holiday",
      start: { dateTime: "2026-07-20T00:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-07-21T00:00:00.0000000", timeZone: "UTC" },
      isAllDay: true,
      showAs: "free",
    };

    const normalized = normalizeMicrosoftEvent(event);
    expect(normalized?.allDay).toBe(true);
    expect(normalized?.blocksTime).toBe(false);
  });

  it("maps cancelled and tentative events", () => {
    const cancelled: GraphEvent = {
      id: "event-3",
      subject: "Cancelled",
      start: { dateTime: "2026-07-15T14:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-07-15T15:00:00.0000000", timeZone: "UTC" },
      isCancelled: true,
      showAs: "busy",
    };
    const tentative: GraphEvent = {
      id: "event-4",
      subject: "Maybe",
      start: { dateTime: "2026-07-15T14:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-07-15T15:00:00.0000000", timeZone: "UTC" },
      showAs: "tentative",
    };

    expect(normalizeMicrosoftEvent(cancelled)?.status).toBe("cancelled");
    expect(normalizeMicrosoftEvent(cancelled)?.blocksTime).toBe(false);
    expect(normalizeMicrosoftEvent(tentative)?.status).toBe("tentative");
  });

  it("redacts private event titles", () => {
    const event: GraphEvent = {
      id: "event-5",
      subject: "Doctor visit",
      sensitivity: "private",
      start: { dateTime: "2026-07-15T14:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-07-15T15:00:00.0000000", timeZone: "UTC" },
    };

    expect(normalizeMicrosoftEvent(event)?.title).toBe("Private event");
  });

  it("maps removed delta records", () => {
    const event: GraphEvent = {
      id: "event-6",
      subject: "Removed",
      start: { dateTime: "2026-07-15T14:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-07-15T15:00:00.0000000", timeZone: "UTC" },
      "@removed": { reason: "deleted" },
    };

    const normalized = normalizeMicrosoftEvent(event);
    expect(normalized?.isRemoved).toBe(true);
    expect(normalized?.status).toBe("cancelled");
  });

  it("is idempotent across repeated normalization", () => {
    const event: GraphEvent = {
      id: "event-7",
      subject: "CS 101 Lecture",
      start: { dateTime: "2026-07-15T14:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-07-15T15:00:00.0000000", timeZone: "UTC" },
      showAs: "busy",
    };

    const first = normalizeMicrosoftEvent(event);
    const second = normalizeMicrosoftEvent(event);
    expect(first?.contentHash).toBe(second?.contentHash);
  });

  it("detects stale sync windows", () => {
    const staleEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldResetSyncWindow(staleEnd)).toBe(true);
    const freshEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldResetSyncWindow(freshEnd)).toBe(false);
  });

  it("normalizes batches with warnings for invalid rows", () => {
    const result = normalizeMicrosoftEvents([
      {
        id: "valid",
        subject: "Valid",
        start: { dateTime: "2026-07-15T14:00:00.0000000", timeZone: "UTC" },
        end: { dateTime: "2026-07-15T15:00:00.0000000", timeZone: "UTC" },
      },
    ]);
    expect(result.events).toHaveLength(1);
    expect(result.warnings).toBe(0);
  });
});
