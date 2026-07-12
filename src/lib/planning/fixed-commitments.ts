import { getAppLocalDateKey } from "@/lib/dates/timezone";
import {
  buildAvailabilityIntervalsForDay,
  hasEnabledAvailabilityForDay,
} from "@/lib/planning/availability";
import {
  clipIntervals,
  dayBoundsInterval,
  expandInterval,
  intersectIntervals,
  mergeIntervals,
  subtractIntervals,
  toInterval,
  totalDurationMinutes,
} from "@/lib/planning/intervals";
import type {
  PlanningEvent,
  PlanningPreferences,
  TimeInterval,
} from "@/lib/planning/types";
import {
  BLOCKING_EVENT_TYPES,
  TRAVEL_BUFFER_EVENT_TYPES,
} from "@/lib/planning/types";

function isBlockingEvent(event: PlanningEvent): boolean {
  if (event.status === "cancelled" || event.status === "tentative") {
    return false;
  }

  if (event.eventType === "deadline" || !event.blocksTime) {
    return false;
  }

  return BLOCKING_EVENT_TYPES.includes(event.eventType);
}

function buildTimedBlockingIntervals(
  events: PlanningEvent[],
  travelBufferMinutes: number,
): TimeInterval[] {
  const intervals: TimeInterval[] = [];

  for (const event of events) {
    if (!isBlockingEvent(event) || event.allDay) continue;

    let interval = toInterval(event.startAt, event.endAt);

    if (TRAVEL_BUFFER_EVENT_TYPES.includes(event.eventType)) {
      interval = expandInterval(interval, travelBufferMinutes);
    }

    intervals.push(interval);
  }

  return mergeIntervals(intervals);
}

function buildAllDayBlockingIntervals(
  events: PlanningEvent[],
  dateKey: string,
  availabilityIntervals: TimeInterval[],
): TimeInterval[] {
  const hasAllDayBlocker = events.some(
    (event) =>
      event.allDay &&
      isBlockingEvent(event) &&
      getAppLocalDateKey(event.startAt) <= dateKey &&
      getAppLocalDateKey(event.endAt) > dateKey,
  );

  if (!hasAllDayBlocker || availabilityIntervals.length === 0) {
    return [];
  }

  return [...availabilityIntervals];
}

export function buildBlockingIntervalsForDay(
  events: PlanningEvent[],
  dateKey: string,
  availabilityIntervals: TimeInterval[],
  preferences: PlanningPreferences,
): { blocking: TimeInterval[]; scheduledFocus: TimeInterval[] } {
  const dayEvents = events.filter((event) => {
    const startKey = getAppLocalDateKey(event.startAt);
    const endKey = getAppLocalDateKey(event.endAt);
    return startKey <= dateKey && endKey >= dateKey;
  });

  const timedBlocking = buildTimedBlockingIntervals(
    dayEvents,
    preferences.travelBufferMinutes,
  );

  const allDayBlocking = buildAllDayBlockingIntervals(
    dayEvents,
    dateKey,
    availabilityIntervals,
  );

  const blocking = mergeIntervals([...timedBlocking, ...allDayBlocking]);

  const scheduledFocus = mergeIntervals(
    dayEvents
      .filter(
        (event) =>
          event.eventType === "focus_block" &&
          event.status === "confirmed" &&
          !event.allDay,
      )
      .map((event) => toInterval(event.startAt, event.endAt)),
  );

  const clippedBlocking =
    availabilityIntervals.length > 0
      ? intersectIntervals(blocking, availabilityIntervals)
      : blocking;

  const scheduledWithinAvailability =
    availabilityIntervals.length > 0
      ? intersectIntervals(scheduledFocus, availabilityIntervals)
      : [];

  return {
    blocking: clippedBlocking,
    scheduledFocus: scheduledWithinAvailability,
  };
}

export function computeDayCapacity(input: {
  dateKey: string;
  dayStart: Date;
  dayEnd: Date;
  events: PlanningEvent[];
  availabilityIntervals: TimeInterval[];
  preferences: PlanningPreferences;
  hasAvailabilityRules: boolean;
}): {
  availabilityMinutes: number;
  fixedMinutes: number;
  rawOpenMinutes: number;
  reservedBufferMinutes: number;
  availableFocusMinutes: number;
  scheduledFocusMinutes: number;
  needsAvailabilityConfiguration: boolean;
  openIntervals: TimeInterval[];
} {
  const {
    dateKey,
    dayStart,
    dayEnd,
    events,
    availabilityIntervals,
    preferences,
    hasAvailabilityRules,
  } = input;

  const bounds = dayBoundsInterval(dayStart, dayEnd);
  const clippedAvailability = clipIntervals(availabilityIntervals, bounds);
  const availabilityMinutes = totalDurationMinutes(clippedAvailability);

  if (!hasAvailabilityRules) {
    return {
      availabilityMinutes: 0,
      fixedMinutes: 0,
      rawOpenMinutes: 0,
      reservedBufferMinutes: 0,
      availableFocusMinutes: 0,
      scheduledFocusMinutes: 0,
      needsAvailabilityConfiguration: true,
      openIntervals: [],
    };
  }

  const { blocking, scheduledFocus } = buildBlockingIntervalsForDay(
    events,
    dateKey,
    clippedAvailability,
    preferences,
  );

  const blockingWithinAvailability = intersectIntervals(
    blocking,
    clippedAvailability,
  );
  const fixedMinutes = totalDurationMinutes(blockingWithinAvailability);
  const scheduledFocusMinutes = totalDurationMinutes(
    intersectIntervals(scheduledFocus, clippedAvailability),
  );

  const openIntervals = subtractIntervals(
    clippedAvailability,
    blockingWithinAvailability,
  );
  const rawOpenMinutes = totalDurationMinutes(openIntervals);
  const reservedBufferMinutes = Math.floor(
    (rawOpenMinutes * preferences.planningBufferPercent) / 100,
  );
  const availableFocusMinutes = Math.max(
    0,
    rawOpenMinutes - reservedBufferMinutes,
  );

  return {
    availabilityMinutes,
    fixedMinutes,
    rawOpenMinutes,
    reservedBufferMinutes,
    availableFocusMinutes,
    scheduledFocusMinutes,
    needsAvailabilityConfiguration: false,
    openIntervals,
  };
}

export function getTentativeEventIds(events: PlanningEvent[]): string[] {
  return events
    .filter((event) => event.status === "tentative")
    .map((event) => event.id);
}

export { buildAvailabilityIntervalsForDay, hasEnabledAvailabilityForDay };
