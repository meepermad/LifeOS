import { createHash } from "crypto";
import type {
  FocusBlockProposal,
  PlanningProposalInput,
} from "@/lib/planning/types";

function canonicalizePlanningInputs(inputs: PlanningProposalInput): string {
  const payload = {
    events: inputs.events
      .map((event) => ({
        id: event.id,
        start: event.startAt,
        end: event.endAt,
        type: event.eventType,
        status: event.status,
        blocks_time: event.blocksTime,
        all_day: event.allDay,
        related_task_id: event.relatedTaskId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    tasks: inputs.tasks
      .map((task) => ({
        id: task.id,
        status: task.status,
        remaining: task.remainingMinutes,
        estimated: task.estimatedMinutes,
        due: task.dueAt,
        earliest: task.earliestStartAt,
        priority: task.priority,
        difficulty: task.difficulty,
        splittable: task.splittable,
        min_block: task.minimumBlockMinutes,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    availability: inputs.availabilityRules
      .map((rule) => ({
        day: rule.dayOfWeek,
        start: rule.availableStart,
        end: rule.availableEnd,
        enabled: rule.isEnabled,
      }))
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
    preferences: inputs.preferences,
    pending: inputs.pendingProposalIntervals,
    accepted: inputs.acceptedProposalIntervals,
    periodType: inputs.periodType,
    periodStart: inputs.periodStart.toISOString(),
    periodEnd: inputs.periodEnd.toISOString(),
    dayKeys: inputs.dayKeys,
  };

  return JSON.stringify(payload);
}

export function computePlanningInputHash(inputs: PlanningProposalInput): string {
  return createHash("sha256")
    .update(canonicalizePlanningInputs(inputs))
    .digest("hex");
}

export function computeProposalHash(input: {
  taskId: string;
  proposedStartAt: string;
  proposedEndAt: string;
  taskRemainingMinutes: number;
  unscheduledRemainingMinutes: number;
}): string {
  const payload = {
    task_id: input.taskId,
    start: input.proposedStartAt,
    end: input.proposedEndAt,
    remaining: input.taskRemainingMinutes,
    unscheduled: input.unscheduledRemainingMinutes,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function matchesProposalHash(
  proposal: FocusBlockProposal,
  taskRemainingMinutes: number,
  unscheduledRemainingMinutes: number,
): boolean {
  const expected = computeProposalHash({
    taskId: proposal.taskId,
    proposedStartAt: proposal.proposedStartAt,
    proposedEndAt: proposal.proposedEndAt,
    taskRemainingMinutes,
    unscheduledRemainingMinutes,
  });

  return proposal.proposalHash === expected;
}
