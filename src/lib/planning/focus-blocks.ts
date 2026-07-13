import { toUtcFromAppLocal } from "@/lib/dates/timezone";
import {
  intervalDurationMinutes,
  mergeIntervals,
  toInterval,
} from "@/lib/planning/intervals";
import { buildProposalExplanation } from "@/lib/planning/proposal-explanations";
import { computeProposalHash } from "@/lib/planning/proposal-hash";
import { shrinkIntervalsForBreaks } from "@/lib/planning/proposal-validation";
import type {
  FocusBlockProposal,
  PlanningPreferences,
  PlanningTask,
  ProposalExplanation,
  TimeInterval,
} from "@/lib/planning/types";

const DIFFICULT_WORK_THRESHOLD = 4;

export function chooseBlockSize(input: {
  remainingMinutes: number;
  splittable: boolean;
  minimumBlockMinutes: number;
  preferredFocusBlockMinutes: number;
  maximumFocusBlockMinutes: number;
  dayBudgetMinutes: number;
}): number | null {
  const {
    remainingMinutes,
    splittable,
    minimumBlockMinutes,
    preferredFocusBlockMinutes,
    maximumFocusBlockMinutes,
    dayBudgetMinutes,
  } = input;

  if (remainingMinutes <= 0 || dayBudgetMinutes <= 0) return null;

  if (!splittable) {
    if (remainingMinutes > dayBudgetMinutes) return null;
    return remainingMinutes;
  }

  const cap = Math.min(
    maximumFocusBlockMinutes,
    dayBudgetMinutes,
    remainingMinutes,
  );

  if (cap < minimumBlockMinutes && remainingMinutes >= minimumBlockMinutes) {
    return null;
  }

  if (remainingMinutes <= minimumBlockMinutes) {
    return Math.min(remainingMinutes, dayBudgetMinutes);
  }

  let size = Math.min(preferredFocusBlockMinutes, cap);

  if (remainingMinutes - size > 0 && remainingMinutes - size < minimumBlockMinutes) {
    if (remainingMinutes <= cap) {
      size = remainingMinutes;
    } else {
      size = Math.min(cap, remainingMinutes - minimumBlockMinutes);
      if (size < minimumBlockMinutes) {
        size = Math.min(cap, remainingMinutes);
      }
    }
  }

  return Math.max(1, Math.min(size, cap));
}

function getDifficultWorkCutoffMs(
  dateKey: string,
  avoidDifficultWorkAfter: string | null,
): number | null {
  if (!avoidDifficultWorkAfter) return null;
  const time = avoidDifficultWorkAfter.slice(0, 5);
  return toUtcFromAppLocal(dateKey, time).getTime();
}

export function findSlotInIntervals(input: {
  intervals: TimeInterval[];
  durationMinutes: number;
  earliestMs?: number;
  latestEndMs?: number;
  preferEndBeforeMs?: number;
}): { startMs: number; endMs: number; preferenceViolations: string[] } | null {
  const {
    intervals,
    durationMinutes,
    earliestMs,
    latestEndMs,
    preferEndBeforeMs,
  } = input;

  const durationMs = durationMinutes * 60_000;
  const candidates: Array<{
    startMs: number;
    endMs: number;
    score: number;
    preferenceViolations: string[];
  }> = [];

  for (const interval of intervals) {
    let startMs = interval.startMs;
    if (earliestMs != null) {
      startMs = Math.max(startMs, earliestMs);
    }

    const endMs = startMs + durationMs;
    if (endMs > interval.endMs) continue;
    if (latestEndMs != null && endMs > latestEndMs) continue;

    const preferenceViolations: string[] = [];
    let score = intervalDurationMinutes({ startMs, endMs });

    if (preferEndBeforeMs != null && endMs > preferEndBeforeMs) {
      preferenceViolations.push("before_difficult_work_cutoff");
      score -= 10_000;
    } else if (preferEndBeforeMs != null) {
      score += 100;
    }

    candidates.push({ startMs, endMs, score, preferenceViolations });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score || a.startMs - b.startMs);
  const best = candidates[0];

  return {
    startMs: best.startMs,
    endMs: best.endMs,
    preferenceViolations: best.preferenceViolations,
  };
}

export function placeFocusBlock(input: {
  task: PlanningTask;
  dateKey: string;
  openIntervals: TimeInterval[];
  focusIntervals: TimeInterval[];
  preferences: PlanningPreferences;
  remainingMinutes: number;
  dayBudgetMinutes: number;
  scheduledBefore: number;
  reason: string;
}): FocusBlockProposal | null {
  const {
    task,
    dateKey,
    openIntervals,
    focusIntervals,
    preferences,
    remainingMinutes,
    dayBudgetMinutes,
    scheduledBefore,
    reason,
  } = input;

  const blockSize = chooseBlockSize({
    remainingMinutes,
    splittable: task.splittable,
    minimumBlockMinutes: task.minimumBlockMinutes,
    preferredFocusBlockMinutes: preferences.preferredFocusBlockMinutes,
    maximumFocusBlockMinutes: preferences.maximumFocusBlockMinutes,
    dayBudgetMinutes,
  });

  if (blockSize == null || blockSize <= 0) return null;

  const shrunk = shrinkIntervalsForBreaks(
    openIntervals,
    focusIntervals,
    preferences.minimumBreakMinutes,
  );

  const earliestMs = task.earliestStartAt
    ? new Date(task.earliestStartAt).getTime()
    : undefined;
  const latestEndMs = task.dueAt ? new Date(task.dueAt).getTime() : undefined;
  const preferEndBeforeMs =
    task.difficulty >= DIFFICULT_WORK_THRESHOLD
      ? getDifficultWorkCutoffMs(dateKey, preferences.avoidDifficultWorkAfter)
      : null;

  const slot = findSlotInIntervals({
    intervals: shrunk,
    durationMinutes: blockSize,
    earliestMs,
    latestEndMs: latestEndMs ?? undefined,
    preferEndBeforeMs: preferEndBeforeMs ?? undefined,
  });

  if (!slot) {
    if (!task.splittable) return null;
    return null;
  }

  const preferenceMatches: string[] = [];
  if (blockSize === preferences.preferredFocusBlockMinutes) {
    preferenceMatches.push("preferred_block_length");
  }
  if (
    preferEndBeforeMs != null &&
    !slot.preferenceViolations.includes("before_difficult_work_cutoff")
  ) {
    preferenceMatches.push("before_difficult_work_cutoff");
  }

  const proposedStartAt = new Date(slot.startMs).toISOString();
  const proposedEndAt = new Date(slot.endMs).toISOString();
  const proposedMinutes = blockSize;
  const taskRemaining = task.remainingMinutes ?? task.estimatedMinutes ?? 0;

  const explanation: ProposalExplanation = buildProposalExplanation({
    reason,
    dueAt: task.dueAt,
    availableIntervalMinutes: intervalDurationMinutes({
      startMs: slot.startMs,
      endMs: slot.endMs,
    }),
    taskRemainingMinutes: taskRemaining,
    scheduledTaskMinutesBeforeProposal: scheduledBefore,
    preferenceMatches,
    preferenceViolations: slot.preferenceViolations,
    calibration:
      task.calibrationMeta && task.estimatedMinutes != null
        ? {
            userEstimate: task.estimatedMinutes,
            effectiveEstimate:
              task.effectiveEstimateMinutes ?? task.estimatedMinutes,
            factor: task.calibrationMeta.factor,
            sampleCount: task.calibrationMeta.sampleCount,
            reason: task.calibrationMeta.reason,
          }
        : undefined,
  });

  return {
    taskId: task.id,
    taskTitle: task.title,
    proposedStartAt,
    proposedEndAt,
    proposedMinutes,
    explanation,
    proposalHash: computeProposalHash({
      taskId: task.id,
      proposedStartAt,
      proposedEndAt,
      taskRemainingMinutes: taskRemaining,
      unscheduledRemainingMinutes: remainingMinutes,
    }),
  };
}

export function collectFocusIntervals(
  events: Array<{ startAt: string; endAt: string; eventType?: string; status?: string }>,
  proposals: Array<{ startAt: string; endAt: string }>,
): TimeInterval[] {
  const intervals: TimeInterval[] = [];

  for (const event of events) {
    if (event.eventType === "focus_block" && event.status === "confirmed") {
      intervals.push(toInterval(event.startAt, event.endAt));
    }
  }

  for (const proposal of proposals) {
    intervals.push(toInterval(proposal.startAt, proposal.endAt));
  }

  return mergeIntervals(intervals);
}
