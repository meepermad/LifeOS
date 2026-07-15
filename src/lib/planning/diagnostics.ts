import {
  getRemainingWorkMinutes,
} from "@/lib/planning/remaining-work-math";
import {
  getFutureConfirmedFocusMinutesForTask,
  getUnscheduledRemainingMinutes,
} from "@/lib/planning/proposal-validation";
import { isPlannerEligibleTask, isUnestimatedTask } from "@/lib/planning/task-allocation";
import { totalDurationMinutes } from "@/lib/planning/intervals";
import { buildAvailabilityIntervalsForDays } from "@/lib/planning/availability";
import { computeOpenIntervalsForDay } from "@/lib/planning/open-intervals";
import { hasEnabledAvailabilityForDay } from "@/lib/planning/fixed-commitments";
import type {
  PlanningGenerationResult,
  PlanningProposalInput,
} from "@/lib/planning/types";

export type PlannerTaskDiagnostic = {
  taskId: string;
  deadline: string | null;
  originalEstimate: number | null;
  adaptiveEstimate: number | null;
  trackedMinutes: number;
  futurePlannedMinutes: number;
  remainingMinutes: number | null;
  unscheduledMinutes: number;
  priority: number;
  isDailyPriority: boolean;
  isWeeklyPriority: boolean;
  eligible: boolean;
  exclusionReason: string | null;
  selected: boolean;
};

export type PlannerRunTrace = {
  planningRange: { start: string; end: string; dayKeys: string[] };
  totalAvailableMinutes: number;
  fixedCommitmentMinutes: number;
  existingAcceptedMinutes: number;
  eligibleTaskCount: number;
  excludedTaskCountsByReason: Record<string, number>;
  requiredWorkMinutes: number;
  proposedWorkMinutes: number;
  unmetWorkMinutes: number;
  calibrationApplications: Array<{
    taskId: string;
    factor: number;
    sampleCount: number;
    originalEstimate: number;
    planningEstimate: number;
  }>;
  validationRejections: string[];
  tasks: PlannerTaskDiagnostic[];
};

/**
 * Build a safe planner trace for development/tests.
 * Task titles are intentionally omitted to avoid private content in logs.
 */
export function buildPlannerRunTrace(input: {
  inputs: PlanningProposalInput;
  result: PlanningGenerationResult;
}): PlannerRunTrace {
  const { inputs, result } = input;
  const availabilityByDay = buildAvailabilityIntervalsForDays(
    inputs.dayKeys,
    inputs.availabilityRules,
  );

  let totalAvailableMinutes = 0;
  let fixedCommitmentMinutes = 0;

  for (const dateKey of inputs.dayKeys) {
    const open = computeOpenIntervalsForDay({
      dateKey,
      events: inputs.events,
      availabilityIntervals: availabilityByDay.get(dateKey) ?? [],
      preferences: inputs.preferences,
      hasAvailabilityRules: hasEnabledAvailabilityForDay(
        dateKey,
        inputs.availabilityRules,
      ),
      pendingProposalIntervals: [
        ...inputs.pendingProposalIntervals,
        ...inputs.acceptedProposalIntervals,
      ],
    });
    totalAvailableMinutes += open.availableFocusMinutes;
    const availabilityMinutes = totalDurationMinutes(
      availabilityByDay.get(dateKey) ?? [],
    );
    fixedCommitmentMinutes += Math.max(
      0,
      availabilityMinutes - open.availableFocusMinutes,
    );
  }

  const excludedTaskCountsByReason: Record<string, number> = {};
  const selectedIds = new Set(result.proposals.map((p) => p.taskId));
  const calibrationApplications: PlannerRunTrace["calibrationApplications"] =
    [];
  const tasks: PlannerTaskDiagnostic[] = [];

  let requiredWorkMinutes = 0;
  let eligibleTaskCount = 0;

  for (const task of inputs.tasks) {
    const eligibility = isPlannerEligibleTask(task, inputs.now);
    if (!eligibility.eligible) {
      const reason = eligibility.reason ?? "excluded";
      excludedTaskCountsByReason[reason] =
        (excludedTaskCountsByReason[reason] ?? 0) + 1;
    } else {
      eligibleTaskCount += 1;
    }

    if (isUnestimatedTask(task) && eligibility.eligible) {
      excludedTaskCountsByReason.missing_estimate =
        (excludedTaskCountsByReason.missing_estimate ?? 0) + 1;
    }

    const futurePlanned = getFutureConfirmedFocusMinutesForTask(
      task,
      inputs.events,
      inputs.now,
    );
    const remaining = getRemainingWorkMinutes(task);
    const unscheduled = getUnscheduledRemainingMinutes(
      task,
      inputs.events,
      inputs.now,
    );

    if (eligibility.eligible && remaining != null) {
      requiredWorkMinutes += remaining;
    }

    if (
      task.calibrationMeta &&
      task.estimatedMinutes != null &&
      task.effectiveEstimateMinutes != null &&
      task.calibrationMeta.factor !== 1
    ) {
      calibrationApplications.push({
        taskId: task.id,
        factor: task.calibrationMeta.factor,
        sampleCount: task.calibrationMeta.sampleCount,
        originalEstimate: task.estimatedMinutes,
        planningEstimate: task.effectiveEstimateMinutes,
      });
    }

    tasks.push({
      taskId: task.id,
      deadline: task.dueAt,
      originalEstimate: task.estimatedMinutes,
      adaptiveEstimate: task.effectiveEstimateMinutes ?? null,
      trackedMinutes: task.trackedMinutes ?? 0,
      futurePlannedMinutes: futurePlanned,
      remainingMinutes: remaining,
      unscheduledMinutes: unscheduled,
      priority: task.priority,
      isDailyPriority: Boolean(task.isDailyPriority),
      isWeeklyPriority: Boolean(task.isWeeklyPriority),
      eligible: eligibility.eligible,
      exclusionReason: eligibility.reason,
      selected: selectedIds.has(task.id),
    });
  }

  const existingAcceptedMinutes = inputs.acceptedProposalIntervals.reduce(
    (sum, interval) => {
      const mins =
        (new Date(interval.endAt).getTime() -
          new Date(interval.startAt).getTime()) /
        60_000;
      return sum + Math.max(0, mins);
    },
    0,
  );

  return {
    planningRange: {
      start: inputs.periodStart.toISOString(),
      end: inputs.periodEnd.toISOString(),
      dayKeys: inputs.dayKeys,
    },
    totalAvailableMinutes,
    fixedCommitmentMinutes,
    existingAcceptedMinutes,
    eligibleTaskCount,
    excludedTaskCountsByReason,
    requiredWorkMinutes,
    proposedWorkMinutes: result.totalProposedMinutes,
    unmetWorkMinutes: result.unscheduledMinutes,
    calibrationApplications,
    validationRejections: [],
    tasks,
  };
}

export function validateExplanationConsistency(input: {
  inputs: PlanningProposalInput;
  result: PlanningGenerationResult;
}): string[] {
  const errors: string[] = [];
  const { inputs, result } = input;

  for (const proposal of result.proposals) {
    const task = inputs.tasks.find((t) => t.id === proposal.taskId);
    if (!task) continue;

    if (proposal.explanation.calibration) {
      const cal = proposal.explanation.calibration;
      if (
        task.calibrationMeta &&
        Math.abs(cal.factor - task.calibrationMeta.factor) > 0.001
      ) {
        errors.push(
          `${proposal.taskId}: explanation factor ${cal.factor} != applied ${task.calibrationMeta.factor}`,
        );
      }
    }

    if (
      proposal.explanation.dueAt &&
      proposal.proposedEndAt > proposal.explanation.dueAt &&
      !proposal.explanation.reason.includes("overdue")
    ) {
      errors.push(
        `${proposal.taskId}: block ends after cited deadline without overdue reason`,
      );
    }

    const siblings = result.proposals.filter((p) => p.taskId === proposal.taskId);
    if (
      proposal.explanation.splitRecommendation &&
      siblings.length < 2 &&
      proposal.explanation.splitRecommendation.includes(",")
    ) {
      errors.push(
        `${proposal.taskId}: split explanation but only ${siblings.length} block(s)`,
      );
    }
  }

  if (
    result.unscheduledMinutes > 0 &&
    result.atRiskTaskIds.length === 0 &&
    result.unschedulableTasks.length === 0
  ) {
    errors.push(
      "Insufficient capacity reported without identifying at-risk or unschedulable tasks",
    );
  }

  return errors;
}
