import { addDays, format, getDay } from "date-fns";
import {
  addAppDays,
  getAppLocalDateKey,
  nowInAppTimezone,
} from "@/lib/dates/timezone";
import type { TimeOfDayPreference } from "@/lib/assistant/intents";

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export type ParsedDate = {
  dateKey: string;
  label: string;
};

export type ParsedTimeRange = {
  startTime: string;
  endTime: string;
};

function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function getReferenceNow(now?: Date): Date {
  return now ?? nowInAppTimezone();
}

export function parseRelativeDate(
  text: string,
  now = getReferenceNow(),
): ParsedDate | null {
  const lower = text.toLowerCase().trim();
  const todayKey = getAppLocalDateKey(now);

  if (/\btoday\b/.test(lower)) {
    return { dateKey: todayKey, label: "today" };
  }

  if (/\btomorrow\b/.test(lower)) {
    const tomorrowKey = addAppDays(todayKey, 1);
    return { dateKey: tomorrowKey, label: "tomorrow" };
  }

  if (/\bthis week\b/.test(lower)) {
    return { dateKey: todayKey, label: "this week" };
  }

  for (let index = 0; index < WEEKDAY_NAMES.length; index += 1) {
    const name = WEEKDAY_NAMES[index];
    const pattern = new RegExp(`\\b${name}\\b`, "i");
    if (!pattern.test(lower)) continue;

    const currentDay = getDay(now);
    let daysAhead = index - currentDay;
    if (daysAhead <= 0) daysAhead += 7;

    const target = addDays(now, daysAhead);
    const dateKey = formatDateKey(target);
    return { dateKey, label: name };
  }

  const isoMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return { dateKey: isoMatch[1], label: isoMatch[1] };
  }

  const slashMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10);
    const day = Number.parseInt(slashMatch[2], 10);
    const year =
      slashMatch[3] != null
        ? Number.parseInt(
            slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3],
            10,
          )
        : now.getFullYear();
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { dateKey, label: dateKey };
  }

  for (let monthIndex = 0; monthIndex < MONTH_NAMES.length; monthIndex += 1) {
    const monthName = MONTH_NAMES[monthIndex];
    const pattern = new RegExp(
      `\\b${monthName}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`,
      "i",
    );
    const match = lower.match(pattern);
    if (!match) continue;

    const day = Number.parseInt(match[1], 10);
    const year = match[2]
      ? Number.parseInt(match[2], 10)
      : now.getFullYear();
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { dateKey, label: `${monthName} ${day}` };
  }

  return null;
}

function parseHourMinute(token: string): string | null {
  const trimmed = token.trim().toLowerCase();

  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let hour = Number.parseInt(match12[1], 10);
    const minute = match12[2] ? Number.parseInt(match12[2], 10) : 0;
    const meridiem = match12[3].toLowerCase();
    if (hour === 12) hour = meridiem === "am" ? 0 : 12;
    else if (meridiem === "pm") hour += 12;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const match24 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (match24) {
    const hour = Number.parseInt(match24[1], 10);
    const minute = match24[2] ? Number.parseInt(match24[2], 10) : 0;
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return null;
}

export function parseTimeRange(text: string): ParsedTimeRange | null {
  const lower = text.toLowerCase();

  const rangeMatch = lower.match(
    /(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|–|-|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (rangeMatch) {
    const endMeridiem = rangeMatch[2].match(/(am|pm)/i)?.[1];
    let startToken = rangeMatch[1];
    if (endMeridiem && !/(am|pm)/i.test(startToken)) {
      startToken = `${startToken} ${endMeridiem}`;
    }
    const startTime = parseHourMinute(startToken);
    const endTime = parseHourMinute(rangeMatch[2]);
    if (startTime && endTime) {
      return { startTime, endTime };
    }
  }

  const atMatch = lower.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (atMatch) {
    const startTime = parseHourMinute(atMatch[1]);
    if (startTime) {
      const [hour, minute] = startTime.split(":").map(Number);
      const endHour = hour + 1;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      return { startTime, endTime };
    }
  }

  return null;
}

export function parseTimeOfDayPreference(
  text: string,
): TimeOfDayPreference | undefined {
  const lower = text.toLowerCase();
  if (/\bmorning\b/.test(lower)) return "morning";
  if (/\bafternoon\b/.test(lower)) return "afternoon";
  if (/\bevening\b/.test(lower)) return "evening";
  return undefined;
}

export function parseBeforeDate(
  text: string,
  now = getReferenceNow(),
): ParsedDate | null {
  const lower = text.toLowerCase();
  const beforeMatch = lower.match(/\bbefore\s+(.+?)(?:\s*$|\s+(?:morning|afternoon|evening))/i);
  if (!beforeMatch) return null;
  return parseRelativeDate(beforeMatch[1], now);
}

export function getTimeOfDayBounds(
  preference: TimeOfDayPreference,
): { startTime: string; endTime: string } {
  switch (preference) {
    case "morning":
      return { startTime: "06:00", endTime: "12:00" };
    case "afternoon":
      return { startTime: "12:00", endTime: "17:00" };
    case "evening":
      return { startTime: "17:00", endTime: "22:00" };
  }
}

export function extractDateFromText(
  text: string,
  now = getReferenceNow(),
): ParsedDate | null {
  return parseRelativeDate(text, now);
}
