import { toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";
import { toUtcFromAppLocal, toUtcFromAppLocalDate } from "@/lib/dates/timezone";
import {
  clipIntervals,
  dayBoundsInterval,
  mergeIntervals,
  toInterval,
  totalDurationMinutes,
} from "@/lib/planning/intervals";
import type {
  PlanningAvailabilityRule,
  TimeInterval,
} from "@/lib/planning/types";

function getDayOfWeek(dateKey: string): number {
  const zoned = toZonedTime(toUtcFromAppLocalDate(dateKey), APP_TIMEZONE);
  return zoned.getDay();
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function buildAvailabilityIntervalsForDay(
  dateKey: string,
  rules: PlanningAvailabilityRule[],
): TimeInterval[] {
  const dayOfWeek = getDayOfWeek(dateKey);
  const enabledRules = rules.filter(
    (rule) => rule.isEnabled && rule.dayOfWeek === dayOfWeek,
  );

  if (enabledRules.length === 0) return [];

  const intervals = enabledRules.map((rule) => {
    const start = toUtcFromAppLocal(dateKey, rule.availableStart.slice(0, 5));
    const end = toUtcFromAppLocal(dateKey, rule.availableEnd.slice(0, 5));
    return toInterval(start, end);
  });

  return mergeIntervals(intervals);
}

export function buildAvailabilityIntervalsForDays(
  dayKeys: string[],
  rules: PlanningAvailabilityRule[],
): Map<string, TimeInterval[]> {
  const map = new Map<string, TimeInterval[]>();

  for (const dateKey of dayKeys) {
    map.set(dateKey, buildAvailabilityIntervalsForDay(dateKey, rules));
  }

  return map;
}

export function availabilityMinutesForDay(
  dateKey: string,
  rules: PlanningAvailabilityRule[],
  dayStart: Date,
  dayEnd: Date,
): number {
  const intervals = buildAvailabilityIntervalsForDay(dateKey, rules);
  const clipped = clipIntervals(intervals, dayBoundsInterval(dayStart, dayEnd));
  return totalDurationMinutes(clipped);
}

export function hasEnabledAvailabilityForDay(
  dateKey: string,
  rules: PlanningAvailabilityRule[],
): boolean {
  const dayOfWeek = getDayOfWeek(dateKey);
  return rules.some((rule) => rule.isEnabled && rule.dayOfWeek === dayOfWeek);
}

export { timeToMinutes };
