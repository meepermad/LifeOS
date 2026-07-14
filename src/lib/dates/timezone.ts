import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  parse,
  startOfWeek,
} from "date-fns";
import { APP_TIMEZONE } from "@/lib/constants";

export { APP_TIMEZONE };

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export type ParsedLocalWallClockTime = {
  hours: number;
  minutes: number;
  seconds: number;
  normalized: string;
};

export function nowInAppTimezone(): Date {
  return toZonedTime(new Date(), APP_TIMEZONE);
}

export function isValidIanaTimeZone(timezone: string): boolean {
  if (!timezone || timezone.trim().length === 0) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseLocalWallClockTime(localTime: string): ParsedLocalWallClockTime {
  const match = LOCAL_TIME_RE.exec(localTime.trim());
  if (!match) {
    throw new Error(`Invalid local time: ${localTime}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");
  const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { hours, minutes, seconds, normalized };
}

/**
 * Resolve a local wall-clock preference (date + time in an IANA zone) to a UTC instant.
 * Accepts HH:MM and HH:MM:SS. Never uses the host server's local timezone.
 */
export function resolveLocalNotificationInstant(input: {
  localDate: string;
  localTime: string;
  timezone: string;
}): Date {
  if (!LOCAL_DATE_RE.test(input.localDate)) {
    throw new Error(`Invalid local date: ${input.localDate}`);
  }
  if (!isValidIanaTimeZone(input.timezone)) {
    throw new Error(`Invalid IANA timezone: ${input.timezone}`);
  }

  const { normalized } = parseLocalWallClockTime(input.localTime);
  const localIso = `${input.localDate}T${normalized}`;
  const utc = fromZonedTime(localIso, input.timezone);

  if (Number.isNaN(utc.getTime())) {
    throw new Error("Unable to resolve local notification instant");
  }

  return utc;
}

export function toUtcFromProfileLocal(
  dateStr: string,
  timeStr: string,
  timezone: string,
): Date {
  const utc = resolveLocalNotificationInstant({
    localDate: dateStr,
    localTime: timeStr,
    timezone,
  });

  const { hours, minutes } = parseLocalWallClockTime(timeStr);
  const expected = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const roundTrip = formatInTimeZone(utc, timezone, "yyyy-MM-dd'T'HH:mm");
  if (roundTrip !== expected) {
    throw new Error(
      "Invalid or ambiguous local time around daylight-saving transition",
    );
  }

  return utc;
}

export function toUtcFromAppLocal(
  dateStr: string,
  timeStr: string,
): Date {
  return toUtcFromProfileLocal(dateStr, timeStr, APP_TIMEZONE);
}

export function getLocalDateKeyInTimezone(
  date: Date | string,
  timezone: string,
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(value, timezone, "yyyy-MM-dd");
}

/** Sunday = 0 … Saturday = 6 in the given IANA timezone. */
export function getLocalWeekdayInTimezone(
  date: Date | string,
  timezone: string,
): number {
  const value = typeof date === "string" ? new Date(date) : date;
  // date-fns: i = ISO day of week (1 = Monday … 7 = Sunday)
  const isoDay = Number(formatInTimeZone(value, timezone, "i"));
  return isoDay === 7 ? 0 : isoDay;
}

export function getWeekStartKeyInTimezone(
  dateKey: string,
  weekStartsOn: 0 | 1,
  timezone: string,
): string {
  // Resolve weekday in the target zone, then subtract calendar days from the
  // date key. Avoids host-timezone leakage from date-fns local getters.
  const noonInZone = fromZonedTime(`${dateKey}T12:00:00`, timezone);
  const weekday = getLocalWeekdayInTimezone(noonInZone, timezone);
  const daysFromWeekStart =
    weekStartsOn === 0 ? weekday : weekday === 0 ? 6 : weekday - 1;
  return addAppDays(dateKey, -daysFromWeekStart);
}

export function toUtcFromAppLocalDate(dateStr: string): Date {
  const localIso = `${dateStr}T00:00:00`;
  return fromZonedTime(localIso, APP_TIMEZONE);
}

export function toUtcEndOfAppLocalDay(dateStr: string): Date {
  const localDate = parse(dateStr, "yyyy-MM-dd", new Date());
  const zonedEnd = endOfDay(toZonedTime(localDate, APP_TIMEZONE));
  return fromZonedTime(
    format(zonedEnd, "yyyy-MM-dd'T'HH:mm:ss"),
    APP_TIMEZONE,
  );
}

export function formatAppDate(date: Date | string, pattern = "EEEE, MMMM d"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(value, APP_TIMEZONE, pattern);
}

export function formatAppTime(date: Date | string, pattern = "h:mm a"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(value, APP_TIMEZONE, pattern);
}

export function formatAppDateTime(date: Date | string): string {
  return `${formatAppDate(date, "MMM d, yyyy")} ${formatAppTime(date)}`;
}

export function formatAppTimeRange(start: Date | string, end: Date | string): string {
  return `${formatAppTime(start)} – ${formatAppTime(end)}`;
}

export function getAppLocalDateKey(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(value, APP_TIMEZONE, "yyyy-MM-dd");
}

export function getWeekBounds(
  reference: Date,
  weekStartsOn: 0 | 1,
  weekOffset = 0,
): { start: Date; end: Date } {
  const zoned = toZonedTime(reference, APP_TIMEZONE);
  const shifted = addDays(zoned, weekOffset * 7);
  const start = startOfWeek(shifted, { weekStartsOn });
  const end = endOfWeek(shifted, { weekStartsOn });
  return {
    start: fromZonedTime(format(start, "yyyy-MM-dd'T'00:00:00"), APP_TIMEZONE),
    end: fromZonedTime(format(end, "yyyy-MM-dd'T'23:59:59"), APP_TIMEZONE),
  };
}

export function getDayBoundsInUtc(dateKey: string): { start: Date; end: Date } {
  return {
    start: toUtcFromAppLocalDate(dateKey),
    end: toUtcEndOfAppLocalDay(dateKey),
  };
}

export function splitDateTimeForForm(utcDate: Date | string): {
  date: string;
  time: string;
} {
  const value = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return {
    date: formatInTimeZone(value, APP_TIMEZONE, "yyyy-MM-dd"),
    time: formatInTimeZone(value, APP_TIMEZONE, "HH:mm"),
  };
}

export function splitTimeForForm(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

export function isOverdue(dueAt: string | null, now = new Date()): boolean {
  if (!dueAt) return false;
  return new Date(dueAt) < now;
}

export function isDueToday(dueAt: string | null, now = new Date()): boolean {
  if (!dueAt) return false;
  return getAppLocalDateKey(dueAt) === getAppLocalDateKey(now);
}

export function getTodayBoundsUtc(now = new Date()): { start: Date; end: Date } {
  const dateKey = getAppLocalDateKey(now);
  return getDayBoundsInUtc(dateKey);
}

export function startOfAppDayUtc(dateKey: string): Date {
  return toUtcFromAppLocalDate(dateKey);
}

export function addAppDays(dateKey: string, days: number): string {
  const base = parse(dateKey, "yyyy-MM-dd", new Date());
  return format(addDays(base, days), "yyyy-MM-dd");
}

export function getWeekDayKeys(
  weekStart: Date,
  weekStartsOn: 0 | 1,
): string[] {
  const zoned = toZonedTime(weekStart, APP_TIMEZONE);
  const start = startOfWeek(zoned, { weekStartsOn });
  return Array.from({ length: 7 }, (_, index) =>
    format(addDays(start, index), "yyyy-MM-dd"),
  );
}
