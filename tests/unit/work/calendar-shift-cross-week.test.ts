import { describe, expect, it } from "vitest";
import {
  buildParsedShiftFromDrop,
  buildWorkShiftDraftForMove,
} from "@/lib/work/calendar-shift-move";
import { reconcileWeeklyShifts } from "@/lib/work/shift-reconciliation";
import type { EventWithCalendar } from "@/lib/data/events";

function makeEvent(overrides: Partial<EventWithCalendar>): EventWithCalendar {
  return {
    id: "evt-1",
    user_id: "user-1",
    calendar_id: "cal-work",
    class_meeting_id: null,
    external_event_id: "work-shift:2026-07-12",
    work_profile_id: null,
    title: "Work",
    description: null,
    location: "Office",
    start_at: "2026-07-12T19:00:00.000Z",
    end_at: "2026-07-13T03:00:00.000Z",
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

describe("calendar shift cross-week move", () => {
  it("keeps source-week and destination-week shifts in the reconcile draft", () => {
    const sourceShift = makeEvent({});
    const sameWeekShift = makeEvent({
      id: "evt-same-week",
      external_event_id: "work-shift:2026-07-13",
      start_at: "2026-07-13T19:00:00.000Z",
      end_at: "2026-07-14T03:00:00.000Z",
    });
    const destinationWeekShift = makeEvent({
      id: "evt-dest-week",
      external_event_id: "work-shift:2026-07-20",
      start_at: "2026-07-20T19:00:00.000Z",
      end_at: "2026-07-21T03:00:00.000Z",
    });

    const parsed = {
      startAt: "2026-07-20T19:00:00.000Z",
      endAt: "2026-07-21T03:00:00.000Z",
      allDay: false,
      title: "Work",
      description: null,
      location: "Office",
      calendarId: "cal-work",
      eventType: "work" as const,
      status: "confirmed" as const,
    };

    const existing = [sourceShift, sameWeekShift, destinationWeekShift];
    const draft = buildWorkShiftDraftForMove(sourceShift, parsed, existing);

    expect(draft).toHaveLength(3);
    expect(draft.find((shift) => shift.eventId === "evt-1")?.dateKey).toBe(
      "2026-07-20",
    );
    expect(
      draft.find((shift) => shift.eventId === "evt-same-week")?.dateKey,
    ).toBe("2026-07-13");
    expect(
      draft.find((shift) => shift.eventId === "evt-dest-week")?.dateKey,
    ).toBe("2026-07-20");

    const { items } = reconcileWeeklyShifts({
      draftShifts: draft,
      existingShifts: existing,
      removeOmitted: false,
    });

    const updated = items.find((item) => item.action === "updated");
    expect(updated).toBeTruthy();
    expect(updated?.eventId).toBe("evt-1");
    expect(items.some((item) => item.action === "removed")).toBe(false);
    expect(draft).toHaveLength(3);
  });

  it("preserves break and note when building the moved shift", () => {
    const event = makeEvent({});
    const moved = buildParsedShiftFromDrop(event, {
      startAt: "2026-07-20T19:00:00.000Z",
      endAt: "2026-07-21T03:00:00.000Z",
      allDay: false,
      title: "Work",
      description: null,
      location: "Office",
      calendarId: "cal-work",
      eventType: "work",
      status: "confirmed",
    });

    expect(moved.unpaidBreakMinutes).toBe(30);
    expect(moved.note).toBe("Close");
    expect(moved.eventId).toBe("evt-1");
  });
});
