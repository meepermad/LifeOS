import { describe, expect, it } from "vitest";
import { expandClassMeeting, expandAllMeetings } from "@/lib/academic/meeting-expansion";
import { reconcileSemesterOccurrences } from "@/lib/academic/semester-reconciliation";
import type { AcademicExceptionRow, ClassMeetingRow } from "@/types/domain";

const meeting: ClassMeetingRow = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "u",
  course_id: "22222222-2222-2222-2222-222222222222",
  days_of_week: [1, 3],
  start_time: "09:30",
  end_time: "10:45",
  effective_start_date: "2026-08-24",
  effective_end_date: "2026-12-11",
  location: "Cardwell 101",
  is_online: false,
  timezone: "America/Chicago",
  source_canvas_uid: null,
  content_hash: null,
  created_at: "",
  updated_at: "",
};

function makeException(
  partial: Partial<AcademicExceptionRow> & Pick<AcademicExceptionRow, "exception_type" | "start_date" | "end_date">,
): AcademicExceptionRow {
  return {
    id: "e1",
    user_id: "u",
    academic_term_id: "t1",
    course_id: null,
    suppresses_classes: true,
    blocks_availability: false,
    informational_only: false,
    title: "Exception",
    notes: null,
    altered_schedule: null,
    preset_key: null,
    is_user_modified: false,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

function existingEvent(occurrence: ReturnType<typeof expandClassMeeting>[number]) {
  return {
    id: "ev1",
    external_event_id: `academic:${meeting.id}:${occurrence.dateKey}`,
    class_meeting_id: meeting.id,
    start_at: occurrence.startAt,
    end_at: occurrence.endAt,
    title: occurrence.title,
    location: occurrence.location,
    content_hash: occurrence.contentHash,
    source: "academic",
    event_type: "class",
    status: "confirmed",
  } as never;
}

describe("reconciliation scenarios", () => {
  it("clips meetings to term classes_end", () => {
    const occurrences = expandClassMeeting({
      meeting: { ...meeting, effective_end_date: "2026-12-31" },
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [],
      termClassesEnd: "2026-12-11",
    });
    expect(occurrences.every((o) => o.dateKey <= "2026-12-11")).toBe(true);
  });

  it("updates when start time changes", () => {
    const base = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    })[0];
    const changed = expandClassMeeting({
      meeting: { ...meeting, start_time: "10:00" },
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    })[0];
    const { items } = reconcileSemesterOccurrences({
      desiredOccurrences: [changed],
      existingEvents: [existingEvent(base)],
      removeOmitted: false,
    });
    expect(items[0]?.action).toBe("updated");
  });

  it("removes occurrences when break added after materialization", () => {
    const before = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    });
    const after = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [
        makeException({
          exception_type: "break",
          start_date: "2026-08-24",
          end_date: "2026-08-31",
        }),
      ],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    });
    const { items } = reconcileSemesterOccurrences({
      desiredOccurrences: after,
      existingEvents: before.map(existingEvent),
      removeOmitted: true,
    });
    expect(items.some((item) => item.action === "removed")).toBe(true);
  });

  it("recreates occurrences when break removed after materialization", () => {
    const withBreak = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [
        makeException({
          exception_type: "break",
          start_date: "2026-08-24",
          end_date: "2026-08-31",
        }),
      ],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    });
    const restored = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    });
    const { items } = reconcileSemesterOccurrences({
      desiredOccurrences: restored,
      existingEvents: [],
      removeOmitted: true,
    });
    expect(items.filter((item) => item.action === "created").length).toBeGreaterThan(0);
    expect(withBreak.length).toBe(0);
  });

  it("updates altered schedule occurrence times", () => {
    const base = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    })[0];
    const altered = expandClassMeeting({
      meeting,
      courseTitle: "Algorithms",
      courseCode: "CIS 501",
      exceptions: [
        makeException({
          exception_type: "altered_schedule",
          start_date: base.dateKey,
          end_date: base.dateKey,
          suppresses_classes: false,
          altered_schedule: { startTime: "13:00", endTime: "14:15" },
        }),
      ],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    })[0];
    const { items } = reconcileSemesterOccurrences({
      desiredOccurrences: [altered],
      existingEvents: [existingEvent(base)],
      removeOmitted: false,
    });
    expect(items[0]?.action).toBe("updated");
  });

  it("marks identical re-save as unchanged", () => {
    const occurrences = expandAllMeetings({
      meetings: [{ meeting, courseTitle: "Algorithms", courseCode: "CIS 501" }],
      exceptions: [],
      termClassesStart: "2026-08-24",
      termClassesEnd: "2026-08-31",
    });
    const { items } = reconcileSemesterOccurrences({
      desiredOccurrences: occurrences,
      existingEvents: occurrences.map(existingEvent),
      removeOmitted: true,
    });
    expect(items.every((item) => item.action === "unchanged")).toBe(true);
  });
});
