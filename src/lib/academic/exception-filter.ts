import type { AcademicExceptionRow } from "@/types/domain";

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

export function evaluateExceptionForMeeting(input: {
  dateKey: string;
  courseId: string;
  exceptions: AcademicExceptionRow[];
}): ExceptionEvaluation {
  const { dateKey, courseId, exceptions } = input;

  for (const exception of exceptions) {
    if (!dateInRange(dateKey, exception.start_date, exception.end_date)) {
      continue;
    }
    if (!appliesToCourse(exception, courseId)) {
      continue;
    }

    if (
      exception.suppresses_classes &&
      (exception.exception_type === "no_classes" ||
        exception.exception_type === "break" ||
        exception.exception_type === "university_closed" ||
        exception.exception_type === "class_cancelled" ||
        exception.exception_type === "custom" ||
        exception.exception_type === "finals_period")
    ) {
      return { suppressed: true, reason: exception.title };
    }

    if (exception.exception_type === "altered_schedule" && exception.altered_schedule) {
      const schedule = exception.altered_schedule as {
        startTime?: string;
        endTime?: string;
      };
      if (schedule.startTime && schedule.endTime) {
        return {
          suppressed: false,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          reason: exception.title,
        };
      }
    }
  }

  return { suppressed: false };
}

export function getExceptionsBlockingAvailability(
  dateKey: string,
  exceptions: AcademicExceptionRow[],
): AcademicExceptionRow[] {
  return exceptions.filter(
    (exception) =>
      exception.blocks_availability &&
      dateInRange(dateKey, exception.start_date, exception.end_date),
  );
}

export function findExceptionByPhrase(
  phrase: string,
  exceptions: AcademicExceptionRow[],
): AcademicExceptionRow | null {
  const lower = phrase.toLowerCase();
  if (/\bfall break\b/.test(lower)) {
    return (
      exceptions.find(
        (e) =>
          e.exception_type === "break" &&
          /\bfall\b/i.test(e.title),
      ) ?? null
    );
  }
  if (/\bspring break\b/.test(lower)) {
    return (
      exceptions.find(
        (e) =>
          e.exception_type === "break" &&
          /\bspring\b/i.test(e.title),
      ) ?? null
    );
  }
  if (/\bfinals week\b/.test(lower)) {
    return (
      exceptions.find((e) => e.exception_type === "finals_period") ?? null
    );
  }
  return null;
}

export function getActiveBreakForDate(
  dateKey: string,
  exceptions: AcademicExceptionRow[],
): AcademicExceptionRow | null {
  return (
    exceptions.find(
      (exception) =>
        exception.exception_type === "break" &&
        exception.suppresses_classes &&
        dateInRange(dateKey, exception.start_date, exception.end_date),
    ) ?? null
  );
}
