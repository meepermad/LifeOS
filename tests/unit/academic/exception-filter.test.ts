import { describe, expect, it } from "vitest";
import {
  evaluateExceptionForMeeting,
  getExceptionsBlockingAvailability,
  getActiveBreakForDate,
  findExceptionByPhrase,
} from "@/lib/academic/exception-filter";
import type { AcademicExceptionRow } from "@/types/domain";

const COURSE_A = "22222222-2222-2222-2222-222222222222";
const COURSE_B = "33333333-3333-3333-3333-333333333333";

function makeException(
  overrides: Partial<AcademicExceptionRow> & {
    id: string;
    exception_type: AcademicExceptionRow["exception_type"];
    start_date: string;
    end_date: string;
    title: string;
  },
): AcademicExceptionRow {
  return {
    user_id: "u",
    academic_term_id: "t1",
    course_id: null,
    suppresses_classes: false,
    blocks_availability: false,
    informational_only: false,
    notes: null,
    altered_schedule: null,
    preset_key: null,
    is_user_modified: false,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("exception-filter precedence", () => {
  const dateKey = "2026-10-15";

  it("course-specific class_cancelled beats global break", () => {
    const breakEx = makeException({
      id: "b1",
      exception_type: "break",
      start_date: "2026-10-10",
      end_date: "2026-10-20",
      title: "Fall Break",
      suppresses_classes: true,
    });
    const cancelEx = makeException({
      id: "c1",
      exception_type: "class_cancelled",
      start_date: dateKey,
      end_date: dateKey,
      title: "CIS 501 Cancelled",
      course_id: COURSE_A,
      suppresses_classes: true,
    });

    const resultA = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [breakEx, cancelEx],
    });
    expect(resultA.suppressed).toBe(true);
    expect(resultA.reason).toBe("CIS 501 Cancelled");

    const resultB = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_B,
      exceptions: [cancelEx, breakEx],
    });
    expect(resultB.suppressed).toBe(true);
    expect(resultB.reason).toBe("Fall Break");
  });

  it("course-specific altered_schedule beats global break", () => {
    const breakEx = makeException({
      id: "b1",
      exception_type: "break",
      start_date: "2026-10-10",
      end_date: "2026-10-20",
      title: "Fall Break",
      suppresses_classes: true,
    });
    const alteredEx = makeException({
      id: "a1",
      exception_type: "altered_schedule",
      start_date: dateKey,
      end_date: dateKey,
      title: "Exam Review Session",
      course_id: COURSE_A,
      altered_schedule: { startTime: "14:00", endTime: "15:30" },
    });

    const result = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [breakEx, alteredEx],
    });
    expect(result.suppressed).toBe(false);
    expect(result.startTime).toBe("14:00");
    expect(result.endTime).toBe("15:30");
    expect(result.reason).toBe("Exam Review Session");
  });

  it("university_closed suppresses when no higher-priority exception applies", () => {
    const closure = makeException({
      id: "u1",
      exception_type: "university_closed",
      start_date: dateKey,
      end_date: dateKey,
      title: "Weather Closure",
      suppresses_classes: true,
    });
    const alteredGlobal = makeException({
      id: "a1",
      exception_type: "altered_schedule",
      start_date: dateKey,
      end_date: dateKey,
      title: "Late Start",
      altered_schedule: { startTime: "10:00", endTime: "11:00" },
    });

    const withClosure = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [closure],
    });
    expect(withClosure.suppressed).toBe(true);
    expect(withClosure.reason).toBe("Weather Closure");

    const closureWins = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [alteredGlobal, closure],
    });
    expect(closureWins.suppressed).toBe(true);
    expect(closureWins.reason).toBe("Weather Closure");
  });

  it("course-specific altered_schedule beats university_closed for that course", () => {
    const closure = makeException({
      id: "u1",
      exception_type: "university_closed",
      start_date: dateKey,
      end_date: dateKey,
      title: "Weather Closure",
      suppresses_classes: true,
    });
    const alteredEx = makeException({
      id: "a1",
      exception_type: "altered_schedule",
      start_date: dateKey,
      end_date: dateKey,
      title: "Online Session",
      course_id: COURSE_A,
      altered_schedule: { startTime: "13:00", endTime: "14:00" },
    });

    const result = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [closure, alteredEx],
    });
    expect(result.suppressed).toBe(false);
    expect(result.startTime).toBe("13:00");
  });

  it("finals_period with suppresses_classes false does not suppress", () => {
    const finals = makeException({
      id: "f1",
      exception_type: "finals_period",
      start_date: dateKey,
      end_date: dateKey,
      title: "Finals Week",
      suppresses_classes: false,
      informational_only: true,
    });

    const result = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [finals],
    });
    expect(result.suppressed).toBe(false);
  });

  it("course cancellation beats finals_period", () => {
    const finals = makeException({
      id: "f1",
      exception_type: "finals_period",
      start_date: "2026-10-10",
      end_date: "2026-10-20",
      title: "Finals Week",
      suppresses_classes: true,
    });
    const cancelEx = makeException({
      id: "c1",
      exception_type: "class_cancelled",
      start_date: dateKey,
      end_date: dateKey,
      title: "Final Cancelled",
      course_id: COURSE_A,
      suppresses_classes: true,
    });

    const result = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [finals, cancelEx],
    });
    expect(result.suppressed).toBe(true);
    expect(result.reason).toBe("Final Cancelled");
  });

  it("two course-specific exceptions resolve by precedence not insert order", () => {
    const cancelA = makeException({
      id: "c1",
      exception_type: "class_cancelled",
      start_date: dateKey,
      end_date: dateKey,
      title: "Cancelled",
      course_id: COURSE_A,
      suppresses_classes: true,
    });
    const alteredA = makeException({
      id: "a1",
      exception_type: "altered_schedule",
      start_date: dateKey,
      end_date: dateKey,
      title: "Rescheduled",
      course_id: COURSE_A,
      altered_schedule: { startTime: "16:00", endTime: "17:00" },
    });

    const forward = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [cancelA, alteredA],
    });
    const reverse = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [alteredA, cancelA],
    });

    expect(forward).toEqual(reverse);
    expect(forward.suppressed).toBe(false);
    expect(forward.startTime).toBe("16:00");
  });

  it("identical start dates in different orders produce same result", () => {
    const noClasses = makeException({
      id: "n1",
      exception_type: "no_classes",
      start_date: dateKey,
      end_date: dateKey,
      title: "No Classes",
      suppresses_classes: true,
    });
    const custom = makeException({
      id: "x1",
      exception_type: "custom",
      start_date: dateKey,
      end_date: dateKey,
      title: "Custom Day",
      suppresses_classes: true,
    });

    const forward = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [noClasses, custom],
    });
    const reverse = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [custom, noClasses],
    });

    expect(forward).toEqual(reverse);
    expect(forward.suppressed).toBe(true);
    expect(forward.reason).toBe("No Classes");
  });

  it("availability blocking is independent of suppression", () => {
    const breakEx = makeException({
      id: "b1",
      exception_type: "break",
      start_date: dateKey,
      end_date: dateKey,
      title: "Fall Break",
      suppresses_classes: true,
      blocks_availability: false,
    });
    const blocking = makeException({
      id: "u1",
      exception_type: "university_closed",
      start_date: dateKey,
      end_date: dateKey,
      title: "Closure",
      suppresses_classes: true,
      blocks_availability: true,
    });

    const blockingResult = getExceptionsBlockingAvailability(dateKey, [
      breakEx,
      blocking,
    ]);
    expect(blockingResult).toHaveLength(1);
    expect(blockingResult[0]?.id).toBe("u1");

    const evalResult = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [breakEx, blocking],
    });
    expect(evalResult.suppressed).toBe(true);
    expect(evalResult.reason).toBe("Closure");
  });

  it("custom informational exception does not suppress by default", () => {
    const custom = makeException({
      id: "x1",
      exception_type: "custom",
      start_date: dateKey,
      end_date: dateKey,
      title: "Advising Day",
      suppresses_classes: false,
      informational_only: true,
    });

    const result = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [custom],
    });
    expect(result.suppressed).toBe(false);
  });

  it("custom with suppresses_classes true does suppress", () => {
    const custom = makeException({
      id: "x1",
      exception_type: "custom",
      start_date: dateKey,
      end_date: dateKey,
      title: "Department Event",
      suppresses_classes: true,
    });

    const result = evaluateExceptionForMeeting({
      dateKey,
      courseId: COURSE_A,
      exceptions: [custom],
    });
    expect(result.suppressed).toBe(true);
    expect(result.reason).toBe("Department Event");
  });
});

describe("exception-filter helpers", () => {
  it("findExceptionByPhrase selects deterministically", () => {
    const fallBreak1 = makeException({
      id: "b1",
      exception_type: "break",
      start_date: "2026-10-10",
      end_date: "2026-10-17",
      title: "Fall Break 2026",
      suppresses_classes: true,
    });
    const fallBreak2 = makeException({
      id: "b2",
      exception_type: "break",
      start_date: "2026-10-10",
      end_date: "2026-10-14",
      title: "Fall Recess",
      suppresses_classes: true,
    });

    const result = findExceptionByPhrase("fall break", [fallBreak2, fallBreak1]);
    expect(result?.id).toBe("b2");
  });

  it("getActiveBreakForDate is order-independent", () => {
    const break1 = makeException({
      id: "b1",
      exception_type: "break",
      start_date: "2026-10-10",
      end_date: "2026-10-20",
      title: "Long Break",
      suppresses_classes: true,
    });
    const break2 = makeException({
      id: "b2",
      exception_type: "break",
      start_date: "2026-10-15",
      end_date: "2026-10-15",
      title: "Short Break",
      suppresses_classes: true,
    });

    const forward = getActiveBreakForDate("2026-10-15", [break1, break2]);
    const reverse = getActiveBreakForDate("2026-10-15", [break2, break1]);
    expect(forward?.id).toBe(reverse?.id);
  });
});
