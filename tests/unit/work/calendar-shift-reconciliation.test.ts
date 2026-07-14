import { describe, expect, it } from "vitest";
import {
  buildParsedShiftFromDrop,
  buildWorkShiftDraftForMove,
} from "@/lib/work/calendar-shift-move";
import { reconcileWeeklyShifts } from "@/lib/work/shift-reconciliation";
import { buildShiftExternalId } from "@/lib/work/shift-reconciliation";
import type { EventWithCalendar } from "@/lib/data/events";

function makeEvent(overrides: Partial<EventWithCalendar>): EventWithCalendar {
  return {
    id: "evt-1",
    user_id: "user-1",
    calendar_id: "cal-work",
    class_meeting_id: null,
    external_event_id: "work-shift:2026-07-13",
    work_profile_id: null,
    title: "Work",
    description: null,
    location: "Office",
    start_at: "2026-07-13T19:00:00.000Z",
    end_at: "2026-07-14T03:00:00.000Z",
    all_day: false,
    status: "confirmed",
    source: "manual",
    event_type: "work",
    is_read_only: false,
    blocks_time: true,
    unpaid_break_minutes: 30,
    shift_note: "Close",
    shift_source_label: null,
    created_by_assistant: false,
    assistant_action_id: null,
    external_updated_at: null,
    content_hash: null,
    created_at: "",
    updated_at: "",
    calendar_name: "Work",
    calendar_source: "manual",
    related_task_id: null,
    external_change_key: null,
    show_as: null,
    sensitivity: null,
    organizer_name: null,
    online_meeting_url: null,
    ...overrides,
  };
}

describe("calendar work-shift reconciliation", () => {
  it("updates dateKey when a shift is moved across days", () => {
    const event = makeEvent({});
    const parsed = {
      startAt: "2026-07-14T19:00:00.000Z",
      endAt: "2026-07-15T03:00:00.000Z",
      allDay: false,
      title: "Work",
      description: null,
      location: "Office",
      calendarId: "cal-work",
      eventType: "work" as const,
      status: "confirmed" as const,
    };

    const moved = buildParsedShiftFromDrop(event, parsed);
    expect(moved.dateKey).toBe("2026-07-14");
    expect(moved.eventId).toBe("evt-1");
    expect(moved.unpaidBreakMinutes).toBe(30);
    expect(moved.note).toBe("Close");
  });

  it("reconciles a cross-day move as an updated shift", () => {
    const event = makeEvent({});
    const parsed = {
      startAt: "2026-07-14T19:00:00.000Z",
      endAt: "2026-07-15T03:00:00.000Z",
      allDay: false,
      title: "Work",
      description: null,
      location: "Office",
      calendarId: "cal-work",
      eventType: "work" as const,
      status: "confirmed" as const,
    };

    const draftShifts = buildWorkShiftDraftForMove(event, parsed, [event]);
    const { items } = reconcileWeeklyShifts({
      draftShifts,
      existingShifts: [event],
      removeOmitted: false,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.action).toBe("updated");
    expect(items[0]?.shift?.dateKey).toBe("2026-07-14");
    expect(buildShiftExternalId()).toMatch(
      /^work-shift:[0-9a-f-]{36}$/,
    );
  });

  it("keeps unchanged shifts untouched on idempotent repeat", () => {
    const event = makeEvent({});
    const parsed = {
      startAt: event.start_at,
      endAt: event.end_at,
      allDay: false,
      title: event.title,
      description: null,
      location: event.location,
      calendarId: event.calendar_id,
      eventType: "work" as const,
      status: "confirmed" as const,
    };

    const draftShifts = buildWorkShiftDraftForMove(event, parsed, [event]);
    const { items } = reconcileWeeklyShifts({
      draftShifts,
      existingShifts: [event],
      removeOmitted: false,
    });

    expect(items[0]?.action).toBe("unchanged");
  });

  it("preserves overnight and break metadata during move", () => {
    const event = makeEvent({
      unpaid_break_minutes: 45,
      shift_note: "Register 3",
    });
    const parsed = {
      startAt: "2026-07-14T22:00:00.000Z",
      endAt: "2026-07-15T06:00:00.000Z",
      allDay: false,
      title: "Work",
      description: null,
      location: "Office",
      calendarId: "cal-work",
      eventType: "work" as const,
      status: "confirmed" as const,
    };

    const moved = buildParsedShiftFromDrop(event, parsed);
    expect(moved.isOvernight).toBe(true);
    expect(moved.unpaidBreakMinutes).toBe(45);
    expect(moved.note).toBe("Register 3");
  });
});
