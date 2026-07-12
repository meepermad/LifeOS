import type {
  AcademicExceptionRow,
  AcademicExceptionType,
} from "@/types/domain";

export type ExceptionEvaluation = {
  suppressed: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
};

function dateInRange(
  dateKey: string,
  startDate: string,
  endDate: string,
): boolean {
  return dateKey >= startDate && dateKey <= endDate;
}

function appliesToCourse(
  exception: AcademicExceptionRow,
  courseId: string,
): boolean {
  if (!exception.course_id) return true;
  return exception.course_id === courseId;
}

function dateSpanDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00Z`).getTime();
  const end = new Date(`${endDate}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/**
 * Deterministic type precedence (lower = higher priority).
 * Course-specific altered_schedule and class_cancelled rank above global types.
 */
function getTypePrecedenceRank(
  exceptionType: AcademicExceptionType,
  courseSpecific: boolean,
): number {
  switch (exceptionType) {
    case "altered_schedule":
      return courseSpecific ? 1 : 8;
    case "class_cancelled":
      return courseSpecific ? 2 : 4;
    case "university_closed":
      return 3;
    case "no_classes":
      return 4;
    case "break":
      return 5;
    case "finals_period":
      return 6;
    case "custom":
      return 7;
    default:
      return 99;
  }
}

function compareExceptionPrecedence(
  a: AcademicExceptionRow,
  b: AcademicExceptionRow,
): number {
  const aCourseSpecific = a.course_id !== null;
  const bCourseSpecific = b.course_id !== null;
  const aRank = getTypePrecedenceRank(
    a.exception_type as AcademicExceptionType,
    aCourseSpecific,
  );
  const bRank = getTypePrecedenceRank(
    b.exception_type as AcademicExceptionType,
    bCourseSpecific,
  );
  if (aRank !== bRank) return aRank - bRank;

  if (aCourseSpecific !== bCourseSpecific) {
    return aCourseSpecific ? -1 : 1;
  }

  const aSpan = dateSpanDays(a.start_date, a.end_date);
  const bSpan = dateSpanDays(b.start_date, b.end_date);
  if (aSpan !== bSpan) return aSpan - bSpan;

  return a.id.localeCompare(b.id);
}

export function sortExceptionsByPrecedence(
  exceptions: AcademicExceptionRow[],
): AcademicExceptionRow[] {
  return [...exceptions].sort(compareExceptionPrecedence);
}

function getApplicableExceptions(input: {
  dateKey: string;
  courseId?: string;
  exceptions: AcademicExceptionRow[];
}): AcademicExceptionRow[] {
  const { dateKey, courseId, exceptions } = input;
  return exceptions.filter((exception) => {
    if (!dateInRange(dateKey, exception.start_date, exception.end_date)) {
      return false;
    }
    if (courseId !== undefined && !appliesToCourse(exception, courseId)) {
      return false;
    }
    return true;
  });
}

function parseAlteredSchedule(exception: AcademicExceptionRow): {
  startTime: string;
  endTime: string;
} | null {
  if (exception.exception_type !== "altered_schedule" || !exception.altered_schedule) {
    return null;
  }
  const schedule = exception.altered_schedule as {
    startTime?: string;
    endTime?: string;
  };
  if (schedule.startTime && schedule.endTime) {
    return { startTime: schedule.startTime, endTime: schedule.endTime };
  }
  return null;
}

function isSuppressor(exception: AcademicExceptionRow): boolean {
  if (!exception.suppresses_classes) return false;

  return (
    exception.exception_type === "no_classes" ||
    exception.exception_type === "university_closed" ||
    exception.exception_type === "break" ||
    exception.exception_type === "class_cancelled" ||
    exception.exception_type === "custom" ||
    exception.exception_type === "finals_period"
  );
}

export function evaluateExceptionForMeeting(input: {
  dateKey: string;
  courseId: string;
  exceptions: AcademicExceptionRow[];
}): ExceptionEvaluation {
  const applicable = sortExceptionsByPrecedence(
    getApplicableExceptions({
      dateKey: input.dateKey,
      courseId: input.courseId,
      exceptions: input.exceptions,
    }),
  );

  for (const exception of applicable) {
    const altered = parseAlteredSchedule(exception);
    if (altered) {
      return {
        suppressed: false,
        startTime: altered.startTime,
        endTime: altered.endTime,
        reason: exception.title,
      };
    }

    if (isSuppressor(exception)) {
      return { suppressed: true, reason: exception.title };
    }
  }

  return { suppressed: false };
}

export function getExceptionsBlockingAvailability(
  dateKey: string,
  exceptions: AcademicExceptionRow[],
): AcademicExceptionRow[] {
  return sortExceptionsByPrecedence(
    getApplicableExceptions({ dateKey, exceptions }),
  ).filter((exception) => exception.blocks_availability);
}

export function getDisplayContextException(
  dateKey: string,
  exceptions: AcademicExceptionRow[],
): AcademicExceptionRow | null {
  const applicable = sortExceptionsByPrecedence(
    getApplicableExceptions({ dateKey, exceptions }),
  ).filter(
    (exception) =>
      exception.informational_only || exception.exception_type === "finals_period",
  );
  return applicable[0] ?? null;
}

function matchesPhraseException(
  phrase: string,
  exception: AcademicExceptionRow,
): boolean {
  const lower = phrase.toLowerCase();
  if (/\bfall break\b/.test(lower)) {
    return (
      exception.exception_type === "break" && /\bfall\b/i.test(exception.title)
    );
  }
  if (/\bspring break\b/.test(lower)) {
    return (
      exception.exception_type === "break" && /\bspring\b/i.test(exception.title)
    );
  }
  if (/\bfinals week\b/.test(lower)) {
    return exception.exception_type === "finals_period";
  }
  return false;
}

export function findExceptionByPhrase(
  phrase: string,
  exceptions: AcademicExceptionRow[],
): AcademicExceptionRow | null {
  const matches = sortExceptionsByPrecedence(exceptions).filter((exception) =>
    matchesPhraseException(phrase, exception),
  );
  return matches[0] ?? null;
}

export function getActiveBreakForDate(
  dateKey: string,
  exceptions: AcademicExceptionRow[],
): AcademicExceptionRow | null {
  const breaks = sortExceptionsByPrecedence(
    getApplicableExceptions({ dateKey, exceptions }),
  ).filter(
    (exception) =>
      exception.exception_type === "break" && exception.suppresses_classes,
  );
  return breaks[0] ?? null;
}
