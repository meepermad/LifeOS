import { addAppDays } from "@/lib/dates/timezone";
import { getTimeOfDayBounds } from "@/lib/assistant/date-parser";
import type { TimeOfDayPreference } from "@/lib/assistant/intents";
import { findSlotInIntervals } from "@/lib/planning/focus-blocks";
import { computeOpenIntervalsForDays } from "@/lib/planning/open-intervals";
import type { PlanningProposalInput } from "@/lib/planning/types";
import { toUtcFromAppLocal } from "@/lib/dates/timezone";
import { formatAppDate, formatAppTimeRange } from "@/lib/dates/timezone";

export type AvailabilitySlot = {
  dateKey: string;
  startAt: string;
  endAt: string;
  label: string;
};

export type FindAvailabilityInput = {
  durationMinutes: number;
  startDateKey: string;
  endDateKey: string;
  beforeDateKey?: string;
  timeOfDay?: TimeOfDayPreference;
  planningInput: PlanningProposalInput;
  maxResults?: number;
};

function dateKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let current = startKey;
  while (current <= endKey) {
    keys.push(current);
    if (current === endKey) break;
    current = addAppDays(current, 1);
    if (keys.length > 14) break;
  }
  return keys;
}

export function findAvailabilitySlots(
  input: FindAvailabilityInput,
): AvailabilitySlot[] {
  const {
    durationMinutes,
    startDateKey,
    endDateKey,
    beforeDateKey,
    timeOfDay,
    planningInput,
    maxResults = 3,
  } = input;

  const dayKeys = dateKeysBetween(startDateKey, endDateKey);
  const openByDay = computeOpenIntervalsForDays({
    dayKeys,
    events: planningInput.events,
    availabilityRules: planningInput.availabilityRules,
    preferences: planningInput.preferences,
  });

  const timeBounds = timeOfDay ? getTimeOfDayBounds(timeOfDay) : null;
  const beforeMs = beforeDateKey
    ? toUtcFromAppLocal(beforeDateKey, "23:59").getTime()
    : undefined;

  const slots: AvailabilitySlot[] = [];

  for (const dateKey of dayKeys) {
    if (beforeDateKey && dateKey >= beforeDateKey) continue;

    const openDay = openByDay.get(dateKey);
    if (!openDay || openDay.openIntervals.length === 0) continue;

    let earliestMs: number | undefined;
    let latestEndMs: number | undefined;

    if (timeBounds) {
      earliestMs = toUtcFromAppLocal(dateKey, timeBounds.startTime).getTime();
      latestEndMs = toUtcFromAppLocal(dateKey, timeBounds.endTime).getTime();
    }

    if (beforeMs != null) {
      latestEndMs =
        latestEndMs != null
          ? Math.min(latestEndMs, beforeMs)
          : beforeMs;
    }

    const slot = findSlotInIntervals({
      intervals: openDay.openIntervals,
      durationMinutes,
      earliestMs,
      latestEndMs,
    });

    if (!slot) continue;

    const startAt = new Date(slot.startMs).toISOString();
    const endAt = new Date(slot.endMs).toISOString();

    slots.push({
      dateKey,
      startAt,
      endAt,
      label: `${formatAppDate(startAt, "EEEE, MMMM d")}, ${formatAppTimeRange(startAt, endAt)}`,
    });

    if (slots.length >= maxResults) break;
  }

  return slots;
}
