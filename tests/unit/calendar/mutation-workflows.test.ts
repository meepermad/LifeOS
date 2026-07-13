import { describe, expect, it } from "vitest";
import { getEditWorkflow } from "@/lib/calendar/authorization";
import type { EventWithCalendar } from "@/lib/data/events";

function baseEvent(overrides: Partial<EventWithCalendar>): EventWithCalendar {
  return {
    id: "e1",
    user_id: "u1",
    calendar_id: "c1",
    title: "Test",
    description: null,
    location: null,
    start_at: "2026-07-12T10:00:00.000Z",
    end_at: "2026-07-12T11:00:00.000Z",
    all_day: false,
    status: "confirmed",
    event_type: "personal",
    blocks_time: true,
    source: "manual",
    is_read_only: false,
    related_task_id: null,
    class_meeting_id: null,
    external_event_id: null,
    calendar_name: "LifeOS",
    calendar_source: "manual",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as EventWithCalendar;
}

describe("calendar mutation workflows", () => {
  it("classifies sources for mutation routing", () => {
    expect(getEditWorkflow(baseEvent({ source: "manual" }))).toBe("manual");
    expect(getEditWorkflow(baseEvent({ event_type: "deadline" }))).toBe(
      "deadline",
    );
    expect(
      getEditWorkflow(
        baseEvent({
          event_type: "focus_block",
          related_task_id: "t1",
          source: "lifeos",
        }),
      ),
    ).toBe("planning_block");
    expect(getEditWorkflow(baseEvent({ source: "academic" }))).toBe("academic");
  });
});
