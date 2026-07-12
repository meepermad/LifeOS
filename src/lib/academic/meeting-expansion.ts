import { createHash } from "crypto";
import { addDays, format, getDay, parse } from "date-fns";
import { toUtcFromProfileLocal } from "@/lib/dates/timezone";
import type { AcademicExceptionRow, ClassMeetingRow } from "@/types/domain";
import { evaluateExceptionForMeeting } from "@/lib/academic/exception-filter";

export type ExpandedClassOccurrence = {
  classMeetingId: string;
  courseId: string;
  dateKey: string;
  startAt: string;
  endAt: string;
  title: string;
  location: string | null;
  isOnline: boolean;
  contentHash: string;
};

export function buildAcademicExternalId(
  classMeetingId: string,
  dateKey: string,
): string {
  return `academic:${classMeetingId}:${dateKey}`;
}

export function parseAcademicExternalId(
  externalEventId: string,
): { classMeetingId: string; dateKey: string } | null {
  const match = externalEventId.match(
    /^academic:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/,
  );
  if (!match) return null;
  return { classMeetingId: match[1], dateKey: match[2] };
}

function isOvernight(startTime: string, endTime: string): boolean {
  return endTime <= startTime;
}

function dateKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let current = startKey;
  while (current <= endKey) {
    keys.push(current);
    current = format(addDays(parse(current, "yyyy-MM-dd", new Date()), 1), "yyyy-MM-dd");
    if (keys.length > 400) break;
  }
  return keys;
}

export function computeOccurrenceContentHash(input: {
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  isOnline: boolean;
}): string {
  const payload = [
    input.title,
    input.startAt,
    input.endAt,
    input.location ?? "",
    input.isOnline ? "1" : "0",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function expandClassMeeting(input: {
  meeting: ClassMeetingRow;
  courseTitle: string;
  courseCode: string;
  exceptions: AcademicExceptionRow[];
}): ExpandedClassOccurrence[] {
  const { meeting, courseTitle, courseCode, exceptions } = input;
  const title =
    courseCode.trim().length > 0
      ? `${courseCode} — ${courseTitle}`
      : courseTitle;
  const occurrences: ExpandedClassOccurrence[] = [];
  const daySet = new Set(meeting.days_of_week);

  for (const dateKey of dateKeysBetween(
    meeting.effective_start_date,
    meeting.effective_end_date,
  )) {
    const localDate = parse(dateKey, "yyyy-MM-dd", new Date());
    const dayOfWeek = getDay(localDate);
    if (!daySet.has(dayOfWeek)) continue;

    const exceptionResult = evaluateExceptionForMeeting({
      dateKey,
      courseId: meeting.course_id,
      exceptions,
    });
    if (exceptionResult.suppressed) continue;

    const startTime = exceptionResult.startTime ?? meeting.start_time;
    const endTime = exceptionResult.endTime ?? meeting.end_time;
    const overnight = isOvernight(startTime, endTime);

    let startAt: string;
    let endAt: string;
    try {
      startAt = toUtcFromProfileLocal(
        dateKey,
        startTime,
        meeting.timezone,
      ).toISOString();
      const endDateKey = overnight
        ? format(addDays(localDate, 1), "yyyy-MM-dd")
        : dateKey;
      endAt = toUtcFromProfileLocal(
        endDateKey,
        endTime,
        meeting.timezone,
      ).toISOString();
    } catch {
      continue;
    }

    const contentHash = computeOccurrenceContentHash({
      title,
      startAt,
      endAt,
      location: meeting.location,
      isOnline: meeting.is_online,
    });

    occurrences.push({
      classMeetingId: meeting.id,
      courseId: meeting.course_id,
      dateKey,
      startAt,
      endAt,
      title,
      location: meeting.location,
      isOnline: meeting.is_online,
      contentHash,
    });
  }

  return occurrences;
}

export function expandAllMeetings(input: {
  meetings: Array<{
    meeting: ClassMeetingRow;
    courseTitle: string;
    courseCode: string;
  }>;
  exceptions: AcademicExceptionRow[];
}): ExpandedClassOccurrence[] {
  return input.meetings.flatMap((entry) =>
    expandClassMeeting({
      meeting: entry.meeting,
      courseTitle: entry.courseTitle,
      courseCode: entry.courseCode,
      exceptions: input.exceptions,
    }),
  );
}
