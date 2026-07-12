import * as chrono from "chrono-node";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";
import {
  addAppDays,
  getAppLocalDateKey,
  getDayBoundsInUtc,
  nowInAppTimezone,
  toUtcEndOfAppLocalDay,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import type { AcademicExceptionRow, AcademicTermRow } from "@/types/domain";
import { findExceptionByPhrase } from "@/lib/academic/exception-filter";
import {
  getCurrentSemesterTerm,
  getNextSemesterTerm,
} from "@/lib/academic/active-term";

export type DateRangeKind =
  | "day"
  | "week"
  | "month"
  | "rolling"
  | "academic"
  | "explicit"
  | "weekend";

export type ParsedDateRange = {
  start: Date;
  end: Date;
  label: string;
  phrase: string;
  kind: DateRangeKind;
};

export type AcademicRangeContext = {
  terms: AcademicTermRow[];
  exceptions: AcademicExceptionRow[];
  timezone?: string;
};

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function zonedReference(now: Date, timezone: string): Date {
  return toZonedTime(now, timezone);
}

function todayKey(now: Date, timezone: string): string {
  return formatInProfileTz(now, timezone, "yyyy-MM-dd");
}

function formatInProfileTz(
  date: Date,
  timezone: string,
  pattern: string,
): string {
  return format(toZonedTime(date, timezone), pattern);
}

export function getCalendarWeekBounds(
  reference: Date,
  weekOffset = 0,
  timezone: string = APP_TIMEZONE,
): { start: Date; end: Date; startKey: string; endKey: string } {
  const zoned = zonedReference(reference, timezone);
  const shifted = addDays(zoned, weekOffset * 7);
  const start = startOfWeek(shifted, { weekStartsOn: 1 });
  const end = endOfWeek(shifted, { weekStartsOn: 1 });
  const startKey = format(start, "yyyy-MM-dd");
  const endKey = format(end, "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${startKey}T00:00:00`, timezone),
    end: fromZonedTime(`${endKey}T23:59:59`, timezone),
    startKey,
    endKey,
  };
}

function getWeekendBounds(
  reference: Date,
  weekOffset: number,
  timezone: string,
): ParsedDateRange {
  const { startKey } = getCalendarWeekBounds(reference, weekOffset, timezone);
  const weekStart = parse(startKey, "yyyy-MM-dd", new Date());
  const saturdayKey = format(addDays(weekStart, 5), "yyyy-MM-dd");
  const sundayKey = format(addDays(weekStart, 6), "yyyy-MM-dd");
  return {
    start: toUtcFromAppLocalDate(saturdayKey),
    end: toUtcEndOfAppLocalDay(sundayKey),
    label: weekOffset === 0 ? "this weekend" : "next weekend",
    phrase: weekOffset === 0 ? "this weekend" : "next weekend",
    kind: "weekend",
  };
}

function getMonthBounds(
  reference: Date,
  monthOffset: number,
  timezone: string,
): ParsedDateRange {
  const zoned = zonedReference(reference, timezone);
  const target = addDays(startOfMonth(zoned), monthOffset > 0 ? 32 * monthOffset : 0);
  const monthStart = startOfMonth(monthOffset === 0 ? zoned : target);
  if (monthOffset === 1) {
    const next = addDays(endOfMonth(zoned), 1);
    const start = startOfMonth(next);
    const end = endOfMonth(next);
    const startKey = format(start, "yyyy-MM-dd");
    const endKey = format(end, "yyyy-MM-dd");
    return {
      start: fromZonedTime(`${startKey}T00:00:00`, timezone),
      end: fromZonedTime(`${endKey}T23:59:59`, timezone),
      label: "next month",
      phrase: "next month",
      kind: "month",
    };
  }
  const startKey = format(monthStart, "yyyy-MM-dd");
  const endKey = format(endOfMonth(monthStart), "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${startKey}T00:00:00`, timezone),
    end: fromZonedTime(`${endKey}T23:59:59`, timezone),
    label: monthOffset === 0 ? "this month" : "next month",
    phrase: monthOffset === 0 ? "this month" : "next month",
    kind: "month",
  };
}

function parseWeekdayRange(
  text: string,
  now: Date,
  timezone: string,
): ParsedDateRange | null {
  for (let index = 0; index < WEEKDAY_NAMES.length; index += 1) {
    const name = WEEKDAY_NAMES[index];
    const pattern = new RegExp(`\\b${name}\\b`, "i");
    if (!pattern.test(text)) continue;

    const zoned = zonedReference(now, timezone);
    const currentDay = getDay(zoned);
    let daysAhead = index - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    if (/\bnext\b/.test(text)) {
      daysAhead += daysAhead === 0 ? 7 : 0;
      if (index - currentDay <= 0) daysAhead += 7;
    }

    const target = addDays(zoned, daysAhead <= 0 ? daysAhead + 7 : daysAhead);
    const dateKey = format(target, "yyyy-MM-dd");
    const bounds = getDayBoundsInUtc(dateKey);
    return {
      start: bounds.start,
      end: bounds.end,
      label: name,
      phrase: name,
      kind: "day",
    };
  }
  return null;
}

function parseAcademicRange(
  text: string,
  now: Date,
  context?: AcademicRangeContext,
): ParsedDateRange | null {
  if (!context) return null;
  const lower = text.toLowerCase();
  const dateKey = todayKey(now, context.timezone ?? APP_TIMEZONE);

  if (/\bcurrent semester\b/.test(lower)) {
    const term = getCurrentSemesterTerm(context.terms, dateKey);
    if (!term) return null;
    return {
      start: toUtcFromAppLocalDate(term.classes_start),
      end: toUtcEndOfAppLocalDay(term.classes_end),
      label: term.name,
      phrase: "current semester",
      kind: "academic",
    };
  }

  if (/\bnext semester\b/.test(lower)) {
    const term = getNextSemesterTerm(context.terms, dateKey);
    if (!term) return null;
    return {
      start: toUtcFromAppLocalDate(term.classes_start),
      end: toUtcEndOfAppLocalDay(term.classes_end),
      label: term.name,
      phrase: "next semester",
      kind: "academic",
    };
  }

  const exception = findExceptionByPhrase(lower, context.exceptions);
  if (exception) {
    return {
      start: toUtcFromAppLocalDate(exception.start_date),
      end: toUtcEndOfAppLocalDay(exception.end_date),
      label: exception.title,
      phrase: lower.match(/\bfall break\b|\bspring break\b|\bfinals week\b/)?.[0] ?? exception.title,
      kind: "academic",
    };
  }

  if (/\bfinals week\b/.test(lower)) {
    const term = getCurrentSemesterTerm(context.terms, dateKey);
    if (!term?.finals_start || !term.finals_end) return null;
    return {
      start: toUtcFromAppLocalDate(term.finals_start),
      end: toUtcEndOfAppLocalDay(term.finals_end),
      label: "finals week",
      phrase: "finals week",
      kind: "academic",
    };
  }

  return null;
}

function parseExplicitRange(
  text: string,
  now: Date,
  timezone: string,
): ParsedDateRange | null {
  const fromTo = text.match(
    /\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s|$)/i,
  );
  if (fromTo) {
    const start = chrono.parseDate(fromTo[1], { instant: now, timezone });
    const end = chrono.parseDate(fromTo[2], { instant: now, timezone });
    if (start && end) {
      const startKey = format(toZonedTime(start, timezone), "yyyy-MM-dd");
      const endKey = format(toZonedTime(end, timezone), "yyyy-MM-dd");
      return {
        start: fromZonedTime(`${startKey}T00:00:00`, timezone),
        end: fromZonedTime(`${endKey}T23:59:59`, timezone),
        label: `${startKey} to ${endKey}`,
        phrase: fromTo[0].trim(),
        kind: "explicit",
      };
    }
  }

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    const bounds = getDayBoundsInUtc(isoMatch[1]);
    return {
      start: bounds.start,
      end: bounds.end,
      label: isoMatch[1],
      phrase: isoMatch[1],
      kind: "explicit",
    };
  }

  const parsed = chrono.parse(text, now, { forwardDate: true });
  if (parsed.length === 1) {
    const date = parsed[0].start.date();
    const dateKey = format(toZonedTime(date, timezone), "yyyy-MM-dd");
    const bounds = getDayBoundsInUtc(dateKey);
    return {
      start: bounds.start,
      end: bounds.end,
      label: dateKey,
      phrase: parsed[0].text,
      kind: "explicit",
    };
  }

  return null;
}

export function extractDatePhrase(text: string): string | null {
  const lower = text.toLowerCase();
  const patterns = [
    /\bthis week\b/,
    /\bnext week\b/,
    /\bweek after next\b/,
    /\blast week\b/,
    /\bnext seven days\b/,
    /\bthis weekend\b/,
    /\bnext weekend\b/,
    /\bthis month\b/,
    /\bnext month\b/,
    /\bcurrent semester\b/,
    /\bnext semester\b/,
    /\bfall break\b/,
    /\bspring break\b/,
    /\bfinals week\b/,
    /\btoday\b/,
    /\btomorrow\b/,
    /\byesterday\b/,
    /\bfrom\s+.+?\s+to\s+.+?\b/i,
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) return match[0];
  }
  return null;
}

export function parseDateRange(
  text: string,
  options?: {
    now?: Date;
    timezone?: string;
    academicContext?: AcademicRangeContext;
  },
): ParsedDateRange | null {
  const now = options?.now ?? nowInAppTimezone();
  const timezone = options?.timezone ?? APP_TIMEZONE;
  const lower = text.toLowerCase();

  if (/\btoday\b/.test(lower)) {
    const dateKey = getAppLocalDateKey(now);
    const bounds = getDayBoundsInUtc(dateKey);
    return { ...bounds, label: "today", phrase: "today", kind: "day" };
  }

  if (/\btomorrow\b/.test(lower)) {
    const dateKey = addAppDays(getAppLocalDateKey(now), 1);
    const bounds = getDayBoundsInUtc(dateKey);
    return { ...bounds, label: "tomorrow", phrase: "tomorrow", kind: "day" };
  }

  if (/\byesterday\b/.test(lower)) {
    const dateKey = addAppDays(getAppLocalDateKey(now), -1);
    const bounds = getDayBoundsInUtc(dateKey);
    return { ...bounds, label: "yesterday", phrase: "yesterday", kind: "day" };
  }

  if (/\bweek after next\b/.test(lower)) {
    const bounds = getCalendarWeekBounds(now, 2, timezone);
    return {
      start: bounds.start,
      end: bounds.end,
      label: "week after next",
      phrase: "week after next",
      kind: "week",
    };
  }

  if (/\bnext week\b/.test(lower)) {
    const bounds = getCalendarWeekBounds(now, 1, timezone);
    return {
      start: bounds.start,
      end: bounds.end,
      label: "next week",
      phrase: "next week",
      kind: "week",
    };
  }

  if (/\blast week\b/.test(lower)) {
    const bounds = getCalendarWeekBounds(now, -1, timezone);
    return {
      start: bounds.start,
      end: bounds.end,
      label: "last week",
      phrase: "last week",
      kind: "week",
    };
  }

  if (/\bthis week\b/.test(lower)) {
    const bounds = getCalendarWeekBounds(now, 0, timezone);
    return {
      start: bounds.start,
      end: bounds.end,
      label: "this week",
      phrase: "this week",
      kind: "week",
    };
  }

  if (/\bnext seven days\b/.test(lower)) {
    const startKey = getAppLocalDateKey(now);
    const endKey = addAppDays(startKey, 6);
    return {
      start: toUtcFromAppLocalDate(startKey),
      end: toUtcEndOfAppLocalDay(endKey),
      label: "next seven days",
      phrase: "next seven days",
      kind: "rolling",
    };
  }

  if (/\bnext weekend\b/.test(lower)) {
    return getWeekendBounds(now, 1, timezone);
  }

  if (/\bthis weekend\b/.test(lower)) {
    return getWeekendBounds(now, 0, timezone);
  }

  if (/\bnext month\b/.test(lower)) {
    return getMonthBounds(now, 1, timezone);
  }

  if (/\bthis month\b/.test(lower)) {
    return getMonthBounds(now, 0, timezone);
  }

  const academic = parseAcademicRange(lower, now, options?.academicContext);
  if (academic) return academic;

  const weekday = parseWeekdayRange(lower, now, timezone);
  if (weekday) return weekday;

  return parseExplicitRange(text, now, timezone);
}
