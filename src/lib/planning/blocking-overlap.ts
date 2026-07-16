import {
  expandInterval,
  toInterval,
} from "@/lib/planning/intervals";
import type { TimeInterval } from "@/lib/planning/types";
import {
  BLOCKING_EVENT_TYPES,
  TRAVEL_BUFFER_EVENT_TYPES,
  type PlanningEvent,
} from "@/lib/planning/types";

function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.startMs < b.endMs && a.endMs > b.startMs;
}

/**
 * Shared blocking / travel-buffer conflict policy used by generation and acceptance.
 */
export function isBlockingEvent(event: PlanningEvent): boolean {
  if (event.status === "cancelled" || event.status === "tentative") {
    return false;
  }

  if (event.eventType === "deadline" || !event.blocksTime) {
    return false;
  }

  return BLOCKING_EVENT_TYPES.includes(event.eventType);
}

export function blockingIntervalForEvent(
  event: PlanningEvent,
  travelBufferMinutes: number,
): TimeInterval | null {
  if (!isBlockingEvent(event) || event.allDay) {
    return null;
  }

  let interval = toInterval(event.startAt, event.endAt);
  if (
    travelBufferMinutes > 0 &&
    TRAVEL_BUFFER_EVENT_TYPES.includes(event.eventType)
  ) {
    interval = expandInterval(interval, travelBufferMinutes);
  }
  return interval;
}

export function eventBlocksInterval(
  event: PlanningEvent,
  startAt: string,
  endAt: string,
  travelBufferMinutes: number,
): boolean {
  const blocking = blockingIntervalForEvent(event, travelBufferMinutes);
  if (!blocking) return false;
  const target = toInterval(startAt, endAt);
  return intervalsOverlap(blocking, target);
}

export function findBlockingConflict(
  events: PlanningEvent[],
  startAt: string,
  endAt: string,
  travelBufferMinutes: number,
): PlanningEvent | null {
  for (const event of events) {
    if (eventBlocksInterval(event, startAt, endAt, travelBufferMinutes)) {
      return event;
    }
  }
  return null;
}
