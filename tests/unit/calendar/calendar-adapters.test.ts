import { describe, expect, it } from "vitest";
import {
  canDragEvent,
  canResizeEvent,
  getEditWorkflow,
} from "@/lib/calendar/authorization";
import { applyCalendarFilters } from "@/lib/calendar/filters";
import { toCalendarRenderEvent } from "@/lib/calendar/adapters/render-event";
import { getVisibleRangeForView } from "@/lib/calendar/adapters/view-ranges";
import {
  calendarViewToFullCalendar,
  fullCalendarViewToCalendarView,
} from "@/lib/calendar/types";
import type { EventWithCalendar } from "@/lib/data/events";

function buildEvent(overrides: Partial<EventWithCalendar> = {}): EventWithCalendar {
  return {
    id: "event-1",
    user_id: "user-1",
    calendar_id: "calendar-1",
    class_meeting_id: null,
    external_event_id: null,
    work_profile_id: null,
    title: "Meeting",
    description: null,
    location: null,
    start_at: "2026-07-11T15:00:00.000Z",
    end_at: "2026-07-11T16:00:00.000Z",
    all_day: false,
    status: "confirmed",
    source: "manual",
    event_type: "meeting",
    is_read_only: false,
    created_by_assistant: false,
    assistant_action_id: null,
    external_updated_at: null,
    content_hash: null,
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
    calendar_name: "Manual",
    calendar_source: "manual",
    blocks_time: true,
    related_task_id: null,
    external_change_key: null,
    show_as: null,
    sensitivity: null,
    organizer_name: null,
    online_meeting_url: null,
    unpaid_break_minutes: 0,
    shift_note: null,
    shift_source_label: null,
    ...overrides,
  };
}

describe("calendar authorization", () => {
  it("rejects drag for canvas events", () => {
    const event = buildEvent({
      source: "canvas",
      is_read_only: true,
      event_type: "deadline",
    });
    expect(getEditWorkflow(event)).toBe("deadline");
    expect(canDragEvent(event)).toBe(false);
  });

  it("allows drag for manual events", () => {
    const event = buildEvent();
    expect(getEditWorkflow(event)).toBe("manual");
    expect(canDragEvent(event)).toBe(true);
    expect(canResizeEvent(event)).toBe(true);
  });

  it("routes work shifts through work workflow", () => {
    const event = buildEvent({ event_type: "work", source: "workforce_import" });
    expect(getEditWorkflow(event)).toBe("work_shift");
    expect(canDragEvent(event)).toBe(true);
  });

  it("routes planning blocks through planning workflow", () => {
    const event = buildEvent({
      event_type: "focus_block",
      related_task_id: "task-1",
      source: "lifeos",
    });
    expect(getEditWorkflow(event)).toBe("planning_block");
  });
});

describe("calendar filters", () => {
  it("hides cancelled events by default", () => {
    const events = [
      buildEvent({ id: "a" }),
      buildEvent({ id: "b", status: "cancelled" }),
    ];
    const filtered = applyCalendarFilters(events, { showCancelled: false });
    expect(filtered).toHaveLength(1);
  });

  it("filters blocking only", () => {
    const events = [
      buildEvent({ id: "a", blocks_time: true }),
      buildEvent({ id: "b", blocks_time: false, event_type: "deadline" }),
    ];
    const filtered = applyCalendarFilters(events, { blockingOnly: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("a");
  });
});

describe("render adapter", () => {
  it("maps duration-proportional timed events", () => {
    const event = buildEvent({
      start_at: "2026-07-11T15:00:00.000Z",
      end_at: "2026-07-11T17:00:00.000Z",
    });
    const rendered = toCalendarRenderEvent(event);
    expect(rendered.start).toBe(event.start_at);
    expect(rendered.end).toBe(event.end_at);
    expect(rendered.extendedProps?.durationMinutes).toBe(120);
  });

  it("marks all-day deadlines correctly", () => {
    const event = buildEvent({
      all_day: true,
      event_type: "deadline",
      source: "canvas",
      is_read_only: true,
    });
    const rendered = toCalendarRenderEvent(event);
    expect(rendered.allDay).toBe(true);
    expect(rendered.editable).toBe(false);
  });
});

describe("view ranges", () => {
  it("adds buffer to week query range", () => {
    const range = getVisibleRangeForView({
      view: "week",
      anchorDate: "2026-08-24",
      weekStartsOn: 0,
      timezone: "America/Chicago",
    });
    expect(new Date(range.queryStart).getTime()).toBeLessThan(
      new Date(range.start).getTime(),
    );
    expect(new Date(range.queryEnd).getTime()).toBeGreaterThan(
      new Date(range.end).getTime(),
    );
  });
});

describe("view url mapping", () => {
  it("maps week view to timeGridWeek", () => {
    expect(calendarViewToFullCalendar("week")).toBe("timeGridWeek");
    expect(fullCalendarViewToCalendarView("timeGridWeek")).toBe("week");
  });

  it("maps three day view", () => {
    expect(calendarViewToFullCalendar("threeDay")).toBe("timeGridThreeDay");
    expect(fullCalendarViewToCalendarView("timeGridThreeDay")).toBe("threeDay");
  });
});
