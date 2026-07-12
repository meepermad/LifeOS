import { describe, expect, it } from "vitest";
import { expandClassMeeting } from "@/lib/academic/meeting-expansion";
import { evaluateExceptionForMeeting } from "@/lib/academic/exception-filter";
import { reconcileSemesterOccurrences } from "@/lib/academic/semester-reconciliation";
import type {
  AcademicExceptionRow,
  ClassMeetingRow,
} from "@/types/domain";

const meeting: ClassMeetingRow = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "u",
  course_id: "22222222-2222-2222-2222-222222222222",
  days_of_week: [1, 3],
  start_time: "09:30",
  end_time: "10:45",
  effective_start_date: "2026-08-24",
  effective_end_date: "2026-08-31",
  location: "Cardwell 101",
  is_online: false,
  timezone: "America/Chicago",
  source_canvas_uid: null,
  content_hash: null,
  created_at: "",
  updated_at: "",
};

describe("meeting-expansion", () => {
  it("expands Mon/Wed meetings in range", () => {
    const occurrences = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [],
    });
    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences[0].title).toContain("CIS 501");
  });

  it("suppresses classes on break days", () => {
    const exception: AcademicExceptionRow = {
      id: "e1",
      user_id: "u",
      academic_term_id: "t1",
      exception_type: "break",
      start_date: "2026-08-24",
      end_date: "2026-08-24",
      course_id: null,
      suppresses_classes: true,
      blocks_availability: false,
      informational_only: false,
      title: "Break",
      notes: null,
      altered_schedule: null,
      preset_key: null,
      is_user_modified: false,
      created_at: "",
      updated_at: "",
    };
    const result = evaluateExceptionForMeeting({
      dateKey: "2026-08-24",
      courseId: meeting.course_id,
      exceptions: [exception],
    });
    expect(result.suppressed).toBe(true);
  });
});

describe("semester-reconciliation", () => {
  it("marks duplicate occurrences as unchanged", () => {
    const occurrence = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [],
    })[0];

    const { items } = reconcileSemesterOccurrences({
      desiredOccurrences: [occurrence],
      existingEvents: [
        {
          id: "ev1",
          external_event_id: `academic:${meeting.id}:${occurrence.dateKey}`,
          start_at: occurrence.startAt,
          end_at: occurrence.endAt,
          title: occurrence.title,
          location: occurrence.location,
          content_hash: occurrence.contentHash,
        } as never,
      ],
      removeOmitted: false,
    });

    expect(items[0]?.action).toBe("unchanged");
  });
});
