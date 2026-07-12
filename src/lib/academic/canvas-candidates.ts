import { formatInTimeZone } from "date-fns-tz";
import type { EventWithCalendar } from "@/lib/data/events";
import { APP_TIMEZONE } from "@/lib/constants";

export type CanvasMeetingCandidate = {
  id: string;
  courseCode: string | null;
  title: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  location: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
  sourceCanvasUids: string[];
  occurrenceCount: number;
};

const COURSE_CODE_PATTERN = /\b([A-Z]{2,4})\s*(\d{3}[A-Z]?)\b/;

function getLocalDayAndTime(event: EventWithCalendar): {
  dateKey: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
} | null {
  if (event.all_day) return null;
  const dateKey = formatInTimeZone(event.start_at, APP_TIMEZONE, "yyyy-MM-dd");
  const startTime = formatInTimeZone(event.start_at, APP_TIMEZONE, "HH:mm");
  const endTime = formatInTimeZone(event.end_at, APP_TIMEZONE, "HH:mm");
  const dayOfWeek = new Date(`${dateKey}T12:00:00`).getDay();
  return { dateKey, dayOfWeek, startTime, endTime };
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractCourseCode(title: string): string | null {
  const match = title.match(COURSE_CODE_PATTERN);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

function groupKey(event: EventWithCalendar): string | null {
  const local = getLocalDayAndTime(event);
  if (!local) return null;
  return [normalizeTitle(event.title), local.startTime, local.endTime].join("|");
}

export function classifyCanvasMeetingCandidates(input: {
  canvasClassEvents: EventWithCalendar[];
  linkedCanvasUids: Set<string>;
  existingSchoolEvents: EventWithCalendar[];
}): CanvasMeetingCandidate[] {
  const groups = new Map<
    string,
    { events: EventWithCalendar[]; days: Set<number> }
  >();

  for (const event of input.canvasClassEvents) {
    if (event.event_type !== "class" || event.status === "cancelled") continue;
    const uid = event.external_event_id;
    if (uid && input.linkedCanvasUids.has(uid)) continue;

    const key = groupKey(event);
    if (!key) continue;
    const local = getLocalDayAndTime(event);
    if (!local) continue;

    const existing = groups.get(key) ?? { events: [], days: new Set<number>() };
    existing.events.push(event);
    existing.days.add(local.dayOfWeek);
    groups.set(key, existing);
  }

  const candidates: CanvasMeetingCandidate[] = [];

  for (const [, group] of groups) {
    if (group.events.length < 2) continue;

    const sample = group.events[0];
    const local = getLocalDayAndTime(sample);
    if (!local) continue;

    const dateKeys = group.events
      .map((e) => getLocalDayAndTime(e)?.dateKey)
      .filter((d): d is string => Boolean(d))
      .sort();
    const effectiveStartDate = dateKeys[0] ?? local.dateKey;
    const effectiveEndDate = dateKeys[dateKeys.length - 1] ?? local.dateKey;

    const overlapsExisting = input.existingSchoolEvents.some((existing) => {
      const existingLocal = getLocalDayAndTime(existing);
      if (!existingLocal) return false;
      return (
        existingLocal.startTime === local.startTime &&
        existingLocal.endTime === local.endTime &&
        group.days.has(existingLocal.dayOfWeek)
      );
    });
    if (overlapsExisting) continue;

    const occurrenceCount = group.events.length;
    const confidence: CanvasMeetingCandidate["confidence"] =
      occurrenceCount >= 3 ? "high" : occurrenceCount >= 2 ? "medium" : "low";

    const dayLabels = [...group.days]
      .sort()
      .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
      .join("/");

    candidates.push({
      id: `${normalizeTitle(sample.title)}:${local.startTime}:${local.endTime}`,
      courseCode: extractCourseCode(sample.title),
      title: sample.title,
      daysOfWeek: [...group.days].sort(),
      startTime: local.startTime,
      endTime: local.endTime,
      effectiveStartDate,
      effectiveEndDate,
      location: sample.location,
      confidence,
      reason: `Recurring ${dayLabels} ${local.startTime}–${local.endTime}, ${occurrenceCount} Canvas occurrences`,
      sourceCanvasUids: group.events
        .map((e) => e.external_event_id)
        .filter((uid): uid is string => Boolean(uid)),
      occurrenceCount,
    });
  }

  return candidates.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });
}
