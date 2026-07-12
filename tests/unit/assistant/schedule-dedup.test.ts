import { describe, expect, it } from "vitest";
import { deduplicateScheduleEvents } from "@/lib/assistant/schedule-dedup";
import type { EventWithCalendar } from "@/lib/data/events";

function event(partial: Partial<EventWithCalendar> & Pick<EventWithCalendar, "id" | "title" | "start_at" | "end_at">): EventWithCalendar {
  return {
    all_day: false,
    blocks_time: true,
    status: "confirmed",
    event_type: "class",
    source: "canvas",
    calendar_name: "Canvas",
    calendar_source: "canvas",
    calendar_id: "c1",
    user_id: "u1",
    location: null,
    external_event_id: null,
    class_meeting_id: null,
    is_read_only: true,
    content_hash: null,
    created_at: "",
    updated_at: "",
    ...partial,
  } as EventWithCalendar;
}

describe("schedule dedup", () => {
  it("prefers academic class over duplicate canvas class at same time", () => {
    const canvas = event({
      id: "canvas-1",
      title: "CIS 501",
      start_at: "2026-07-13T14:30:00.000Z",
      end_at: "2026-07-13T15:45:00.000Z",
      source: "canvas",
      external_event_id: "canvas-uid-1",
    });
    const academic = event({
      id: "school-1",
      title: "CIS 501 — Algorithms",
      start_at: "2026-07-13T14:30:00.000Z",
      end_at: "2026-07-13T15:45:00.000Z",
      source: "academic",
      calendar_source: "school",
      class_meeting_id: "m1",
    });
    const result = deduplicateScheduleEvents({ events: [canvas, academic] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("school-1");
  });

  it("drops suppressed canvas class uids", () => {
    const canvas = event({
      id: "canvas-1",
      title: "CIS 501",
      start_at: "2026-07-13T14:30:00.000Z",
      end_at: "2026-07-13T15:45:00.000Z",
      external_event_id: "canvas-uid-1",
    });
    const result = deduplicateScheduleEvents({
      events: [canvas],
      suppressedCanvasUids: new Set(["canvas-uid-1"]),
    });
    expect(result).toHaveLength(0);
  });

  it("prefers work_schedule over manual duplicate work event", () => {
    const manual = event({
      id: "manual-work",
      title: "Shift",
      start_at: "2026-07-13T13:00:00.000Z",
      end_at: "2026-07-13T21:00:00.000Z",
      event_type: "work",
      source: "manual",
    });
    const scheduled = event({
      id: "scheduled-work",
      title: "Shift",
      start_at: "2026-07-13T13:00:00.000Z",
      end_at: "2026-07-13T21:00:00.000Z",
      event_type: "work",
      source: "work_schedule",
    });
    const result = deduplicateScheduleEvents({ events: [manual, scheduled] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("scheduled-work");
  });
});
