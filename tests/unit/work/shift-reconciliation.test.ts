import { describe, expect, it } from "vitest";
import { reconcileWeeklyShifts } from "@/lib/work/shift-reconciliation";
import type { EventWithCalendar } from "@/lib/data/events";
import type { ParsedShift } from "@/lib/work/shift-validation";

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
    location: null,
    start_at: "2026-07-13T19:00:00.000Z",
    end_at: "2026-07-14T03:00:00.000Z",
    all_day: false,
    status: "confirmed",
    source: "manual",
    event_type: "work",
    is_read_only: false,
    blocks_time: true,
    unpaid_break_minutes: 30,
    shift_note: null,
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

const baseShift: ParsedShift = {
  dateKey: "2026-07-13",
  startAt: "2026-07-13T19:00:00.000Z",
  endAt: "2026-07-14T03:00:00.000Z",
  isOvernight: true,
  unpaidBreakMinutes: 30,
  location: null,
  note: null,
  title: "Work",
  externalEventId: "work-shift:2026-07-13",
  requiresConfirmation: false,
};

describe("reconcileWeeklyShifts", () => {
  it("marks identical shifts as unchanged", () => {
    const result = reconcileWeeklyShifts({
      draftShifts: [baseShift],
      existingShifts: [makeEvent({})],
      removeOmitted: false,
    });
    expect(result.items[0]?.action).toBe("unchanged");
  });

  it("creates new shifts", () => {
    const result = reconcileWeeklyShifts({
      draftShifts: [baseShift],
      existingShifts: [],
      removeOmitted: false,
    });
    expect(result.items[0]?.action).toBe("created");
  });

  it("does not overwrite a second shift on the same day", () => {
    const first = makeEvent({ id: "evt-1", external_event_id: "work-shift:first" });
    const second = makeEvent({
      id: "evt-2",
      external_event_id: "work-shift:second",
      start_at: "2026-07-13T23:00:00.000Z",
      end_at: "2026-07-14T02:00:00.000Z",
    });
    const result = reconcileWeeklyShifts({
      draftShifts: [
        { ...baseShift, eventId: "evt-1", externalEventId: "work-shift:first" },
        {
          ...baseShift,
          eventId: "evt-2",
          externalEventId: "work-shift:second",
          startAt: second.start_at,
          endAt: second.end_at,
        },
      ],
      existingShifts: [first, second],
      removeOmitted: false,
    });
    expect(result.items.map((item) => item.eventId)).toEqual(["evt-1", "evt-2"]);
    expect(result.items.every((item) => item.action === "unchanged")).toBe(true);
  });

  it("reports omitted shifts without removing by default", () => {
    const result = reconcileWeeklyShifts({
      draftShifts: [],
      existingShifts: [makeEvent({})],
      removeOmitted: false,
    });
    expect(result.omitted).toHaveLength(1);
    expect(result.items).toHaveLength(0);
  });

  it("removes omitted shifts when requested", () => {
    const result = reconcileWeeklyShifts({
      draftShifts: [],
      existingShifts: [makeEvent({})],
      removeOmitted: true,
    });
    expect(result.items[0]?.action).toBe("removed");
  });
});
