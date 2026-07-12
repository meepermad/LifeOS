import { getDay } from "date-fns";
import { addAppDays, getAppLocalDateKey } from "@/lib/dates/timezone";
import { extractDateFromText, parseRelativeDate } from "@/lib/assistant/date-parser";
import type { ParseResult } from "@/lib/assistant/intents";
import { resolveShiftTimeRange } from "@/lib/work/shift-time-resolver";

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WorkShiftEntry = {
  dateKey: string;
  dayLabel: string;
  isOff: boolean;
  startTime?: string;
  endTime?: string;
  isOvernight?: boolean;
};

function resolveWeekdayDate(dayName: string, now: Date): string | null {
  const lower = dayName.toLowerCase();
  const index = WEEKDAY_NAMES.indexOf(lower as (typeof WEEKDAY_NAMES)[number]);
  if (index < 0) return null;

  const currentDay = getDay(now);
  let daysAhead = index - currentDay;
  if (daysAhead <= 0) daysAhead += 7;
  const target = new Date(now);
  target.setDate(target.getDate() + daysAhead);
  return getAppLocalDateKey(target);
}

function parseWeekOffset(text: string): number {
  if (/\bnext week\b/.test(text)) return 1;
  if (/\blast week\b/.test(text)) return -1;
  return 0;
}

function extractWorkShiftSegments(text: string): string[] {
  const segments: string[] = [];
  const pattern =
    /(?:(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.]*?(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|–|-|—)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?|off))/gi;
  const matches = text.match(pattern);
  if (matches) segments.push(...matches);
  return segments;
}

function parseWorkSegment(
  segment: string,
  now: Date,
  weekOffset: number,
): WorkShiftEntry | ParseResult {
  const lower = segment.toLowerCase();
  const dayMatch = lower.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (!dayMatch) {
    return { kind: "unknown", raw: segment };
  }

  let dateKey = resolveWeekdayDate(dayMatch[1], now);
  if (!dateKey) {
    return { kind: "unknown", raw: segment };
  }
  if (weekOffset !== 0) {
    dateKey = addAppDays(dateKey, weekOffset * 7);
  }

  if (/\boff\b/.test(lower)) {
    return {
      dateKey,
      dayLabel: dayMatch[1],
      isOff: true,
    };
  }

  const timeMatch = segment.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|–|-|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (!timeMatch) {
    return {
      kind: "clarification",
      partial: { intent: "add_work_shift", dateKey },
      missingField: "shiftTime",
      prompt: `What hours do you work on ${dayMatch[1]}?`,
    };
  }

  const resolved = resolveShiftTimeRange(`${timeMatch[1]}–${timeMatch[2]}`);
  if (resolved.kind === "clarification") {
    return {
      kind: "clarification",
      partial: { intent: "add_work_shift", dateKey },
      missingField: "shiftTime",
      prompt: resolved.prompt,
    };
  }

  return {
    dateKey,
    dayLabel: dayMatch[1],
    isOff: false,
    startTime: resolved.value.startTime,
    endTime: resolved.value.endTime,
    isOvernight: resolved.value.isOvernight,
  };
}

export function parseShowWorkSchedule(text: string, _now: Date): ParseResult {
  const lower = text.toLowerCase();
  if (
    !/\b(work schedule|when do i work|show my work|my shifts|work next)\b/.test(
      lower,
    )
  ) {
    return { kind: "unknown", raw: text };
  }

  const weekOffset = parseWeekOffset(lower);
  if (/\bnext\b/.test(lower) && /\bshift\b/.test(lower)) {
    return {
      kind: "command",
      command: { intent: "show_work_schedule", scope: "next" },
    };
  }

  return {
    kind: "command",
    command: {
      intent: "show_work_schedule",
      scope: "week",
      weekOffset,
    },
  };
}

export function parseShowWorkHours(text: string): ParseResult {
  const lower = text.toLowerCase();
  if (!/\b(hours|how many hours|how much).*\bwork/.test(lower) && !/\bwork.*hours\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  const weekOffset = /\bnext week\b/.test(lower) ? 1 : 0;
  return {
    kind: "command",
    command: { intent: "show_work_hours", weekOffset },
  };
}

export function parseCopyWorkSchedule(text: string): ParseResult {
  const lower = text.toLowerCase();
  if (!/\bcopy\b/.test(lower) || !/\bwork\b/.test(lower) || !/\bschedule\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  const targetWeekOffset = /\bthis week\b/.test(lower) ? 0 : /\bnext week\b/.test(lower) ? 1 : 0;
  return {
    kind: "command",
    command: {
      intent: "copy_work_schedule",
      sourceWeekOffset: -1,
      targetWeekOffset,
    },
  };
}

export function parseDeleteWorkShift(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();
  if (!/\b(delete|remove|cancel)\b/.test(lower) || !/\bwork\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  const dayMatch = lower.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (!dayMatch) {
    return {
      kind: "clarification",
      partial: { intent: "delete_work_shift" },
      missingField: "shiftDay",
      prompt: "Which day's work shift should I delete?",
    };
  }

  const dateKey = resolveWeekdayDate(dayMatch[1], now);
  if (!dateKey) {
    return { kind: "unknown", raw: text };
  }

  return {
    kind: "command",
    command: { intent: "delete_work_shift", dateKey },
  };
}

export function parseSetWorkSchedule(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();
  if (!/\bi work\b/.test(lower) && !/\bwork\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  const weekOffset = parseWeekOffset(lower);
  const segments = extractWorkShiftSegments(text);
  if (segments.length === 0) {
    return { kind: "unknown", raw: text };
  }

  const shifts: WorkShiftEntry[] = [];
  for (const segment of segments) {
    const parsed = parseWorkSegment(segment, now, weekOffset);
    if ("kind" in parsed) return parsed;
    shifts.push(parsed);
  }

  return {
    kind: "command",
    command: { intent: "set_work_schedule", shifts, weekOffset },
  };
}

export function parseAddWorkShift(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();
  if (
    !/\b(add|create)\b/.test(lower) ||
    !/\bwork\b/.test(lower) ||
    !/\bshift\b/.test(lower)
  ) {
    return { kind: "unknown", raw: text };
  }

  const dayMatch = lower.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|today|tomorrow)\b/,
  );
  let dateKey: string | undefined;
  if (dayMatch) {
    if (dayMatch[1] === "today" || dayMatch[1] === "tomorrow") {
      dateKey = parseRelativeDate(dayMatch[1], now)?.dateKey;
    } else {
      dateKey = resolveWeekdayDate(dayMatch[1], now) ?? undefined;
    }
  } else {
    const date = extractDateFromText(text, now);
    dateKey = date?.dateKey;
  }

  if (!dateKey) {
    return {
      kind: "clarification",
      partial: { intent: "add_work_shift" },
      missingField: "shiftDay",
      prompt: "Which day is the work shift?",
    };
  }

  const timeMatch = text.match(
    /(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|–|-|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (!timeMatch) {
    return {
      kind: "clarification",
      partial: { intent: "add_work_shift", dateKey },
      missingField: "shiftTime",
      prompt: "What are the start and end times?",
    };
  }

  const resolved = resolveShiftTimeRange(`${timeMatch[1]}–${timeMatch[2]}`);
  if (resolved.kind === "clarification") {
    return {
      kind: "clarification",
      partial: { intent: "add_work_shift", dateKey },
      missingField: "shiftTime",
      prompt: resolved.prompt,
    };
  }

  return {
    kind: "command",
    command: {
      intent: "add_work_shift",
      dateKey,
      startTime: resolved.value.startTime,
      endTime: resolved.value.endTime,
      isOvernight: resolved.value.isOvernight,
    },
  };
}

export function parseUpdateWorkShift(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();
  if (!/\b(change|move|update)\b/.test(lower) || !/\bshift\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  const dayMatch = lower.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (!dayMatch) {
    return { kind: "unknown", raw: text };
  }

  const moveMatch = lower.match(/\bto\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  const sourceDateKey = resolveWeekdayDate(dayMatch[1], now);
  if (!sourceDateKey) {
    return { kind: "unknown", raw: text };
  }

  if (moveMatch) {
    const targetDateKey = resolveWeekdayDate(moveMatch[1], now);
    if (!targetDateKey) {
      return { kind: "unknown", raw: text };
    }
    return {
      kind: "command",
      command: {
        intent: "update_work_shift",
        sourceDateKey,
        targetDateKey,
      },
    };
  }

  const timeMatch = text.match(
    /(?:to\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|–|-|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (!timeMatch) {
    return { kind: "unknown", raw: text };
  }

  const resolved = resolveShiftTimeRange(`${timeMatch[1]}–${timeMatch[2]}`);
  if (resolved.kind === "clarification") {
    return {
      kind: "clarification",
      partial: { intent: "update_work_shift", sourceDateKey },
      missingField: "shiftTime",
      prompt: resolved.prompt,
    };
  }

  return {
    kind: "command",
    command: {
      intent: "update_work_shift",
      sourceDateKey,
      startTime: resolved.value.startTime,
      endTime: resolved.value.endTime,
      isOvernight: resolved.value.isOvernight,
    },
  };
}

export function parseWorkOffDay(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();
  if (!/\b(off|not working)\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  const dayMatch = lower.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (!dayMatch) {
    return { kind: "unknown", raw: text };
  }

  const dateKey = resolveWeekdayDate(dayMatch[1], now);
  if (!dateKey) {
    return { kind: "unknown", raw: text };
  }

  return {
    kind: "command",
    command: { intent: "delete_work_shift", dateKey },
  };
}
