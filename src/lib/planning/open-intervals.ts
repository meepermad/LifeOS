import { getDayBoundsInUtc } from "@/lib/dates/timezone";
import { buildAvailabilityIntervalsForDays } from "@/lib/planning/availability";
import {
  buildBlockingIntervalsForDay,
  hasEnabledAvailabilityForDay,
} from "@/lib/planning/fixed-commitments";
import {
  clipIntervals,
  dayBoundsInterval,
  intersectIntervals,
  intervalDurationMinutes,
  mergeIntervals,
  subtractIntervals,
  toInterval,
  totalDurationMinutes,
} from "@/lib/planning/intervals";
import type {
  OpenIntervalsForDay,
  PendingProposalInterval,
  PlanningAvailabilityRule,
  PlanningEvent,
  PlanningPreferences,
  TimeInterval,
} from "@/lib/planning/types";

function pendingIntervalsForDay(
  dateKey: string,
  proposals: PendingProposalInterval[],
): TimeInterval[] {
  return mergeIntervals(
    proposals.map((proposal) => toInterval(proposal.startAt, proposal.endAt)),
  );
}

export function computeOpenIntervalsForDay(input: {
  dateKey: string;
  events: PlanningEvent[];
  availabilityIntervals: TimeInterval[];
  preferences: PlanningPreferences;
  hasAvailabilityRules: boolean;
  pendingProposalIntervals?: PendingProposalInterval[];
  alreadyProposedMinutes?: number;
}): OpenIntervalsForDay {
  const {
    dateKey,
    events,
    availabilityIntervals,
    preferences,
    hasAvailabilityRules,
    pendingProposalIntervals = [],
    alreadyProposedMinutes = 0,
  } = input;

  const { start, end } = getDayBoundsInUtc(dateKey);
  const bounds = dayBoundsInterval(start, end);
  const clippedAvailability = clipIntervals(availabilityIntervals, bounds);

  if (!hasAvailabilityRules) {
    return {
      dateKey,
      openIntervals: [],
      availableFocusMinutes: 0,
      scheduledFocusMinutes: 0,
      needsAvailabilityConfiguration: true,
      remainingProposalBudgetMinutes: 0,
    };
  }

  const { blocking, scheduledFocus } = buildBlockingIntervalsForDay(
    events,
    dateKey,
    clippedAvailability,
    preferences,
  );

  const pendingBlocking = pendingIntervalsForDay(
    dateKey,
    pendingProposalIntervals,
  );

  const blockingWithinAvailability = mergeIntervals([
    ...intersectIntervals(blocking, clippedAvailability),
    ...intersectIntervals(pendingBlocking, clippedAvailability),
  ]);

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
  const remainingProposalBudgetMinutes = Math.max(
    0,
    availableFocusMinutes - alreadyProposedMinutes,
  );

  return {
    dateKey,
    openIntervals,
    availableFocusMinutes,
    scheduledFocusMinutes,
    needsAvailabilityConfiguration: false,
    remainingProposalBudgetMinutes,
  };
}

export function computeOpenIntervalsForDays(input: {
  dayKeys: string[];
  events: PlanningEvent[];
  availabilityRules: PlanningAvailabilityRule[];
  preferences: PlanningPreferences;
  pendingProposalIntervals?: PendingProposalInterval[];
  proposedMinutesByDay?: Map<string, number>;
}): Map<string, OpenIntervalsForDay> {
  const availabilityByDay = buildAvailabilityIntervalsForDays(
    input.dayKeys,
    input.availabilityRules,
  );
  const result = new Map<string, OpenIntervalsForDay>();

  for (const dateKey of input.dayKeys) {
    const availabilityIntervals = availabilityByDay.get(dateKey) ?? [];
    result.set(
      dateKey,
      computeOpenIntervalsForDay({
        dateKey,
        events: input.events,
        availabilityIntervals,
        preferences: input.preferences,
        hasAvailabilityRules: hasEnabledAvailabilityForDay(
          dateKey,
          input.availabilityRules,
        ),
        pendingProposalIntervals: input.pendingProposalIntervals,
        alreadyProposedMinutes: input.proposedMinutesByDay?.get(dateKey) ?? 0,
      }),
    );
  }

  return result;
}

export function isIntervalOpen(
  openIntervals: TimeInterval[],
  startMs: number,
  endMs: number,
): boolean {
  const duration = Math.floor((endMs - startMs) / 60_000);
  if (duration <= 0) return false;

  for (const interval of openIntervals) {
    if (startMs >= interval.startMs && endMs <= interval.endMs) {
      return true;
    }
  }

  return false;
}

export { intervalDurationMinutes };
