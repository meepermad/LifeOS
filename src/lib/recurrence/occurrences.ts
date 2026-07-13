import {
  addDays,
  addMonths,
  addYears,
  format,
  getDay,
  getDaysInMonth,
  parse,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { toUtcFromProfileLocal, toUtcEndOfAppLocalDay } from "@/lib/dates/timezone";
import type {
  OccurrenceDate,
  RecurrenceException,
  RecurrenceRule,
  RecurrenceTemplate,
} from "@/lib/recurrence/types";

function parseLocalDate(dateStr: string, timezone: string): Date {
  return toZonedTime(parse(dateStr, "yyyy-MM-dd", new Date()), timezone);
}

function formatLocalDate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

function clampDayOfMonth(year: number, month: number, day: number): number {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  return Math.min(day, daysInMonth);
}

function getOrdinalWeekdayInMonth(
  year: number,
  month: number,
  weekday: number,
  ordinal: number,
): number | null {
  if (ordinal === -1) {
    const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
    for (let day = daysInMonth; day >= 1; day--) {
      const d = new Date(year, month - 1, day);
      if (getDay(d) === weekday) return day;
    }
    return null;
  }

  let count = 0;
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (getDay(d) === weekday) {
      count++;
      if (count === ordinal) return day;
    }
  }
  return null;
}

function matchesWeeklyInterval(
  date: Date,
  anchor: Date,
  intervalWeeks: number,
  timezone: string,
): boolean {
  const anchorWeek = startOfWeek(anchor, { weekStartsOn: 0 });
  const dateWeek = startOfWeek(date, { weekStartsOn: 0 });
  const diffMs = dateWeek.getTime() - anchorWeek.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks >= 0 && diffWeeks % intervalWeeks === 0;
}

function generateRawOccurrences(
  rule: RecurrenceRule,
  template: Pick<
    RecurrenceTemplate,
    "first_occurrence_date" | "recurrence_timezone" | "end_date"
  >,
  fromDate: string,
  toDate: string,
): string[] {
  const timezone = template.recurrence_timezone;
  const start = parseLocalDate(
    template.first_occurrence_date > fromDate
      ? template.first_occurrence_date
      : fromDate,
    timezone,
  );
  const end = parseLocalDate(toDate, timezone);
  const anchor = parseLocalDate(template.first_occurrence_date, timezone);
  const endLimit = template.end_date
    ? parseLocalDate(template.end_date, timezone)
    : end;

  const dates: string[] = [];
  const seen = new Set<string>();

  const addDate = (d: Date) => {
    if (d < anchor) return;
    if (d > end || d > endLimit) return;
    const key = formatLocalDate(d, timezone);
    if (seen.has(key)) return;
    seen.add(key);
    dates.push(key);
  };

  switch (rule.frequency) {
    case "daily": {
      const interval = rule.interval ?? 1;
      let current = parseLocalDate(fromDate, timezone);
      if (current < anchor) current = anchor;
      while (current <= end && current <= endLimit) {
        const diffDays = Math.floor(
          (current.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
        );
        if (diffDays >= 0 && diffDays % interval === 0) {
          addDate(current);
        }
        current = addDays(current, 1);
      }
      break;
    }
    case "weekdays": {
      let current = parseLocalDate(fromDate, timezone);
      if (current < anchor) current = anchor;
      while (current <= end && current <= endLimit) {
        const dow = getDay(current);
        if (dow >= 1 && dow <= 5) addDate(current);
        current = addDays(current, 1);
      }
      break;
    }
    case "weekly": {
      const interval = rule.interval ?? 1;
      const weekdays = rule.byWeekday ?? [getDay(anchor)];
      let current = parseLocalDate(fromDate, timezone);
      if (current < anchor) current = anchor;
      while (current <= end && current <= endLimit) {
        const dow = getDay(current);
        if (
          weekdays.includes(dow) &&
          matchesWeeklyInterval(current, anchor, interval, timezone)
        ) {
          addDate(current);
        }
        current = addDays(current, 1);
      }
      break;
    }
    case "monthly": {
      const interval = rule.interval ?? 1;
      let monthCursor = parseLocalDate(template.first_occurrence_date, timezone);
      if (parseLocalDate(fromDate, timezone) > monthCursor) {
        monthCursor = parseLocalDate(fromDate.slice(0, 7) + "-01", timezone);
      }
      while (monthCursor <= end && monthCursor <= endLimit) {
        const year = monthCursor.getFullYear();
        const month = monthCursor.getMonth() + 1;
        const anchorYear = anchor.getFullYear();
        const anchorMonth = anchor.getMonth() + 1;
        const monthDiff =
          (year - anchorYear) * 12 + (month - anchorMonth);
        if (monthDiff >= 0 && monthDiff % interval === 0) {
          let day: number | null = null;
          if (rule.monthlyMode === "ordinal_weekday") {
            day = getOrdinalWeekdayInMonth(
              year,
              month,
              rule.weekday ?? 0,
              rule.ordinal ?? 1,
            );
          } else {
            day = clampDayOfMonth(year, month, rule.dayOfMonth ?? 1);
          }
          if (day != null) {
            addDate(new Date(year, month - 1, day));
          }
        }
        monthCursor = addMonths(monthCursor, 1);
      }
      break;
    }
    case "yearly": {
      const interval = rule.interval ?? 1;
      let yearCursor = anchor.getFullYear();
      const endYear = end.getFullYear();
      while (yearCursor <= endYear) {
        const yearDiff = yearCursor - anchor.getFullYear();
        if (yearDiff >= 0 && yearDiff % interval === 0) {
          const day = clampDayOfMonth(
            yearCursor,
            rule.month ?? 1,
            rule.dayOfMonth ?? 1,
          );
          addDate(new Date(yearCursor, (rule.month ?? 1) - 1, day));
        }
        yearCursor += 1;
      }
      break;
    }
    case "custom": {
      const intervalDays = rule.intervalDays ?? 1;
      let current = anchor;
      if (parseLocalDate(fromDate, timezone) > current) {
        const diff = Math.floor(
          (parseLocalDate(fromDate, timezone).getTime() - anchor.getTime()) /
            (24 * 60 * 60 * 1000),
        );
        const steps = Math.floor(diff / intervalDays);
        current = addDays(anchor, steps * intervalDays);
        if (current < parseLocalDate(fromDate, timezone)) {
          current = addDays(current, intervalDays);
        }
      }
      while (current <= end && current <= endLimit) {
        addDate(current);
        current = addDays(current, intervalDays);
      }
      break;
    }
  }

  return dates.sort();
}

function applyExceptions(
  rawDates: string[],
  exceptions: RecurrenceException[],
): OccurrenceDate[] {
  const exceptionByDate = new Map(
    exceptions.map((e) => [e.occurrence_date, e]),
  );
  const movedFrom = new Map<string, string>();
  for (const ex of exceptions) {
    if (ex.exception_type === "moved" && ex.moved_to_date) {
      movedFrom.set(ex.occurrence_date, ex.moved_to_date);
    }
  }

  const result: OccurrenceDate[] = [];

  for (const date of rawDates) {
    const ex = exceptionByDate.get(date);
    if (ex?.exception_type === "skipped" || ex?.exception_type === "cancelled") {
      continue;
    }
    if (ex?.exception_type === "moved" && ex.moved_to_date) {
      result.push({
        occurrenceKey: date,
        scheduledDate: ex.moved_to_date,
        originalDate: date,
      });
      continue;
    }
    result.push({
      occurrenceKey: date,
      scheduledDate: date,
      originalDate: date,
    });
  }

  for (const ex of exceptions) {
    if (
      ex.exception_type === "moved" &&
      ex.moved_to_date &&
      !rawDates.includes(ex.occurrence_date)
    ) {
      result.push({
        occurrenceKey: ex.occurrence_date,
        scheduledDate: ex.moved_to_date,
        originalDate: ex.occurrence_date,
      });
    }
  }

  return result.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

export function generateOccurrencesForTemplate(
  template: RecurrenceTemplate,
  options: { from: string; to: string; exceptions?: RecurrenceException[] },
): OccurrenceDate[] {
  if (!template.is_active || template.paused_at) {
    return [];
  }

  const raw = generateRawOccurrences(
    template.recurrence_rule,
    template,
    options.from,
    options.to,
  );

  let occurrences = applyExceptions(raw, options.exceptions ?? []);

  if (template.occurrence_limit != null) {
    occurrences = occurrences.slice(0, template.occurrence_limit);
  }

  return occurrences.filter(
    (o) => o.scheduledDate >= options.from && o.scheduledDate <= options.to,
  );
}

export function buildOccurrenceDueAt(
  scheduledDate: string,
  dueTime: string | null,
  timezone: string,
): string {
  if (!dueTime) {
    return toUtcEndOfAppLocalDay(scheduledDate).toISOString();
  }
  return toUtcFromProfileLocal(scheduledDate, dueTime, timezone).toISOString();
}

