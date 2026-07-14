import { describe, expect, it } from "vitest";
import { calculateWorkHours } from "@/lib/work/work-hours";
import type { EventWithCalendar } from "@/lib/data/events";

function makeShift(
  start: string,
  end: string,
  breakMin = 0,
): EventWithCalendar {
  return {
    id: "1",
    user_id: "u",
    calendar_id: "c",
    class_meeting_id: null,
    external_event_id: null,
    work_profile_id: null,
    title: "Work",
    description: null,
    location: null,
    start_at: start,
    end_at: end,
    all_day: false,
    status: "confirmed",
    source: "manual",
    event_type: "work",
    is_read_only: false,
    blocks_time: true,
    unpaid_break_minutes: breakMin,
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
  };
}

describe("calculateWorkHours", () => {
  it("subtracts unpaid breaks from worked hours only", () => {
    const summary = calculateWorkHours([
      makeShift("2026-07-13T14:00:00.000Z", "2026-07-13T22:00:00.000Z", 30),
    ]);
    expect(summary.scheduledMinutes).toBe(480);
    expect(summary.workedMinutes).toBe(450);
    expect(summary.shiftCount).toBe(1);
  });

  it("breaks hours down by profile and unassigned shifts", () => {
    const assigned = {
      ...makeShift("2026-07-13T14:00:00.000Z", "2026-07-13T18:00:00.000Z"),
      work_profile_id: "profile-1",
      title: "Campus job",
    };
    const summary = calculateWorkHours(
      [assigned, makeShift("2026-07-14T14:00:00.000Z", "2026-07-14T16:00:00.000Z")],
      { "profile-1": "Campus job" },
    );
    expect(summary.byProfile["profile-1"]).toMatchObject({
      displayName: "Campus job",
      workedMinutes: 240,
      shiftCount: 1,
    });
    expect(summary.byProfile.unassigned).toMatchObject({
      displayName: "Unassigned work",
      workedMinutes: 120,
    });
  });
});
