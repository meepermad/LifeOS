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

export function nowInAppTimezone(): Date {
  return toZonedTime(new Date(), APP_TIMEZONE);
}

export function toUtcFromProfileLocal(
  dateStr: string,
  timeStr: string,
  timezone: string,
): Date {
  const localIso = `${dateStr}T${timeStr}:00`;
  const utc = fromZonedTime(localIso, timezone);

  const roundTrip = formatInTimeZone(utc, timezone, "yyyy-MM-dd'T'HH:mm");
  if (roundTrip !== localIso.slice(0, 16)) {
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
