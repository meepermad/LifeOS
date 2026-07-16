import {
  intervalDurationMinutes,
  mergeIntervals,
  subtractIntervals,
  toInterval,
} from "@/lib/planning/intervals";
import { findBlockingConflict } from "@/lib/planning/blocking-overlap";
import { matchesProposalHash } from "@/lib/planning/proposal-hash";
import { getUnscheduledRemainingWorkMinutes } from "@/lib/planning/remaining-work-math";
import { getTaskWorkloadMinutes } from "@/lib/planning/task-allocation";
import type {
  PlanningEvent,
  PlanningTask,
  ProposalValidationContext,
} from "@/lib/planning/types";
import { ACTIVE_TASK_STATUSES } from "@/lib/planning/types";

export function getFutureConfirmedFocusMinutesForTask(
  task: PlanningTask,
  events: PlanningEvent[],
  now: Date,
): number {
  let total = 0;

  for (const event of events) {
    if (event.eventType !== "focus_block") continue;
    if (event.status !== "confirmed") continue;
    if (event.relatedTaskId !== task.id) continue;
    if (new Date(event.endAt) <= now) continue;
    if (task.dueAt && new Date(event.startAt) > new Date(task.dueAt)) continue;

    total += intervalDurationMinutes(toInterval(event.startAt, event.endAt));
  }

  return total;
}

export function getUnscheduledRemainingMinutes(
  task: PlanningTask,
  events: PlanningEvent[],
  now: Date,
  pendingProposalMinutes = 0,
): number {
  const scheduled = getFutureConfirmedFocusMinutesForTask(task, events, now);
  return getUnscheduledRemainingWorkMinutes(
    task,
    scheduled,
    pendingProposalMinutes,
  );
}

export function validateProposalForAcceptance(
  context: ProposalValidationContext,
): { valid: true } | { valid: false; reason: string; shouldMarkStale: true } {
  const {
    proposal,
    run,
    task,
    events,
    preferences,
    calendarWritable,
    userId,
    ownerUserId,
  } = context;

  if (userId !== ownerUserId) {
    return {
      valid: false,
      reason: "You do not have permission to accept this proposal.",
      shouldMarkStale: true,
    };
  }

  if (proposal.status !== "pending") {
    return {
      valid: false,
      reason: "This proposal is no longer pending.",
      shouldMarkStale: true,
    };
  }

  if (run.status === "stale" || run.status === "rejected") {
    return {
      valid: false,
      reason: "The planning run is no longer active. Regenerate the plan.",
      shouldMarkStale: true,
    };
  }

  if (!task || !ACTIVE_TASK_STATUSES.includes(task.status)) {
    return {
      valid: false,
      reason: "The linked task changed or is no longer active.",
      shouldMarkStale: true,
    };
  }

  if (!calendarWritable) {
    return {
      valid: false,
      reason: "The LifeOS Planning calendar is not writable.",
      shouldMarkStale: true,
    };
  }

  const now = new Date();
  const unscheduled = getUnscheduledRemainingMinutes(task, events, now);
  const remaining = getTaskWorkloadMinutes(task) ?? 0;

  if (
    !matchesProposalHash(
      {
        taskId: proposal.taskId,
        taskTitle: task.title,
        proposedStartAt: proposal.proposedStartAt,
        proposedEndAt: proposal.proposedEndAt,
        proposedMinutes: proposal.proposedMinutes,
        explanation: {
          reason: "",
          dueAt: null,
          availableIntervalMinutes: 0,
          taskRemainingMinutes: remaining,
          scheduledTaskMinutesBeforeProposal: 0,
          preferenceMatches: [],
          preferenceViolations: [],
        },
        proposalHash: proposal.proposalHash,
      },
      remaining,
      unscheduled + proposal.proposedMinutes,
    )
  ) {
    return {
      valid: false,
      reason: "The proposal no longer matches the current task workload.",
      shouldMarkStale: true,
    };
  }

  if (unscheduled < proposal.proposedMinutes) {
    return {
      valid: false,
      reason: "The task no longer has enough unscheduled remaining work.",
      shouldMarkStale: true,
    };
  }

  const startMs = new Date(proposal.proposedStartAt).getTime();
  const endMs = new Date(proposal.proposedEndAt).getTime();
  const travelBufferMinutes = preferences.travelBufferMinutes ?? 0;

  const conflict = findBlockingConflict(
    events,
    proposal.proposedStartAt,
    proposal.proposedEndAt,
    travelBufferMinutes,
  );
  if (conflict) {
    return {
      valid: false,
      reason:
        travelBufferMinutes > 0
          ? "The calendar changed or a required travel buffer is no longer available for this time slot."
          : "The calendar changed and this time slot is no longer open.",
      shouldMarkStale: true,
    };
  }

  if (task.earliestStartAt && startMs < new Date(task.earliestStartAt).getTime()) {
    return {
      valid: false,
      reason: "The task can no longer start at this time.",
      shouldMarkStale: true,
    };
  }

  if (
    task.dueAt &&
    endMs > new Date(task.dueAt).getTime() &&
    new Date(task.dueAt).getTime() >= now.getTime()
  ) {
    return {
      valid: false,
      reason: "This block would extend past the task deadline.",
      shouldMarkStale: true,
    };
  }

  return { valid: true };
}

export function eventsOverlapInterval(
  events: PlanningEvent[],
  startAt: string,
  endAt: string,
  travelBufferMinutes = 0,
): boolean {
  return (
    findBlockingConflict(events, startAt, endAt, travelBufferMinutes) != null
  );
}

export function shrinkIntervalsForBreaks(
  intervals: ReturnType<typeof mergeIntervals>,
  focusIntervals: ReturnType<typeof mergeIntervals>,
  minimumBreakMinutes: number,
): ReturnType<typeof mergeIntervals> {
  if (minimumBreakMinutes <= 0 || focusIntervals.length === 0) {
    return intervals;
  }

  const breakBlocks = focusIntervals.flatMap((focus) => [
    {
      startMs: focus.startMs - minimumBreakMinutes * 60_000,
      endMs: focus.startMs,
    },
    {
      startMs: focus.endMs,
      endMs: focus.endMs + minimumBreakMinutes * 60_000,
    },
  ]);

  return subtractIntervals(intervals, mergeIntervals(breakBlocks));
}

export { mergeIntervals };
