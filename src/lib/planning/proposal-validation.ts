import {
  intervalDurationMinutes,
  mergeIntervals,
  subtractIntervals,
  toInterval,
} from "@/lib/planning/intervals";
import { matchesProposalHash } from "@/lib/planning/proposal-hash";
import { getTaskWorkloadMinutes } from "@/lib/planning/task-allocation";
import type {
  PlanningEvent,
  PlanningTask,
  ProposalValidationContext,
} from "@/lib/planning/types";
import { ACTIVE_TASK_STATUSES } from "@/lib/planning/types";

function isBlockingOverlapEvent(event: PlanningEvent): boolean {
  if (event.status === "cancelled" || event.status === "tentative") {
    return false;
  }
  if (event.eventType === "deadline" || !event.blocksTime) {
    return false;
  }
  return true;
}

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
): number {
  const workload = getTaskWorkloadMinutes(task);
  if (workload == null) return 0;

  const scheduled = getFutureConfirmedFocusMinutesForTask(task, events, now);
  return Math.max(0, workload - scheduled);
}

export function validateProposalForAcceptance(
  context: ProposalValidationContext,
): { valid: true } | { valid: false; reason: string; shouldMarkStale: true } {
  const { proposal, run, task, events, calendarWritable, userId, ownerUserId } =
    context;

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

  for (const event of events) {
    if (!isBlockingOverlapEvent(event)) continue;
    const eventStart = new Date(event.startAt).getTime();
    const eventEnd = new Date(event.endAt).getTime();
    if (eventStart < endMs && eventEnd > startMs) {
      return {
        valid: false,
        reason: "The calendar changed and this time slot is no longer open.",
        shouldMarkStale: true,
      };
    }
  }

  if (task.earliestStartAt && startMs < new Date(task.earliestStartAt).getTime()) {
    return {
      valid: false,
      reason: "The task can no longer start at this time.",
      shouldMarkStale: true,
    };
  }

  if (task.dueAt && endMs > new Date(task.dueAt).getTime()) {
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
): boolean {
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();

  return events.some((event) => {
    if (!isBlockingOverlapEvent(event)) return false;
    const eventStart = new Date(event.startAt).getTime();
    const eventEnd = new Date(event.endAt).getTime();
    return eventStart < endMs && eventEnd > startMs;
  });
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
