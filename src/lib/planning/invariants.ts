import { getAppLocalDateKey } from "@/lib/dates/timezone";
import { getFutureConfirmedFocusMinutesForTask } from "@/lib/planning/proposal-validation";
import {
  getPlanningEstimateMinutes,
  getRemainingWorkMinutes,
} from "@/lib/planning/remaining-work-math";
import type {
  FocusBlockProposal,
  PlanningEvent,
  PlanningGenerationResult,
  PlanningProposalInput,
} from "@/lib/planning/types";

export type InvariantSeverity = "critical" | "major" | "minor";

export type InvariantAssertion = {
  id: string;
  category:
    | "feasibility"
    | "task_allocation"
    | "integrity"
    | "capacity"
    | "explanation";
  severity: InvariantSeverity;
  passed: boolean;
  message: string;
};

export type InvariantReport = {
  assertions: InvariantAssertion[];
  criticalFailures: InvariantAssertion[];
  passCount: number;
  failCount: number;
  passRate: number;
};

function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const a0 = new Date(aStart).getTime();
  const a1 = new Date(aEnd).getTime();
  const b0 = new Date(bStart).getTime();
  const b1 = new Date(bEnd).getTime();
  return a0 < b1 && b0 < a1;
}

function isBlockingEvent(event: PlanningEvent): boolean {
  if (event.status === "cancelled" || event.status === "tentative") {
    return false;
  }
  if (event.eventType === "deadline" || !event.blocksTime) {
    return false;
  }
  return true;
}

function assert(
  assertions: InvariantAssertion[],
  input: Omit<InvariantAssertion, "passed"> & { condition: boolean },
): void {
  assertions.push({
    id: input.id,
    category: input.category,
    severity: input.severity,
    passed: input.condition,
    message: input.message,
  });
}

/** Evaluate planner invariants against a generation result. */
export function evaluatePlannerInvariants(input: {
  inputs: PlanningProposalInput;
  result: PlanningGenerationResult;
}): InvariantReport {
  const { inputs, result } = input;
  const assertions: InvariantAssertion[] = [];
  const periodStartMs = inputs.periodStart.getTime();
  const periodEndMs = inputs.periodEnd.getTime();
  const proposals = result.proposals;

  for (const proposal of proposals) {
    const startMs = new Date(proposal.proposedStartAt).getTime();
    const endMs = new Date(proposal.proposedEndAt).getTime();
    const duration = proposal.proposedMinutes;

    assert(assertions, {
      id: `duration-positive:${proposal.taskId}:${proposal.proposedStartAt}`,
      category: "feasibility",
      severity: "critical",
      condition: duration > 0 && endMs > startMs,
      message: `Block for ${proposal.taskId} must have positive duration`,
    });

    assert(assertions, {
      id: `within-range-start:${proposal.taskId}:${proposal.proposedStartAt}`,
      category: "feasibility",
      severity: "critical",
      condition: startMs >= periodStartMs,
      message: `Proposal for ${proposal.taskId} must not start before planning range`,
    });

    assert(assertions, {
      id: `within-range-end:${proposal.taskId}:${proposal.proposedEndAt}`,
      category: "feasibility",
      severity: "critical",
      condition: endMs <= periodEndMs + 1000,
      message: `Proposal for ${proposal.taskId} must not end after planning range`,
    });

    for (const event of inputs.events) {
      if (!isBlockingEvent(event)) continue;
      if (event.eventType === "focus_block" && event.relatedTaskId === proposal.taskId) {
        continue;
      }
      const overlaps = intervalsOverlap(
        proposal.proposedStartAt,
        proposal.proposedEndAt,
        event.startAt,
        event.endAt,
      );
      assert(assertions, {
        id: `no-block-overlap:${proposal.taskId}:${event.id}`,
        category: "feasibility",
        severity: "critical",
        condition: !overlaps,
        message: `Proposal for ${proposal.taskId} must not overlap blocking event ${event.id}`,
      });
    }
  }

  for (let i = 0; i < proposals.length; i += 1) {
    for (let j = i + 1; j < proposals.length; j += 1) {
      const a = proposals[i];
      const b = proposals[j];
      const overlaps = intervalsOverlap(
        a.proposedStartAt,
        a.proposedEndAt,
        b.proposedStartAt,
        b.proposedEndAt,
      );
      assert(assertions, {
        id: `no-proposal-overlap:${i}:${j}`,
        category: "feasibility",
        severity: "critical",
        condition: !overlaps,
        message: `Proposals must not overlap (${a.taskId} vs ${b.taskId})`,
      });
    }
  }

  const minutesByTask = new Map<string, number>();
  for (const proposal of proposals) {
    minutesByTask.set(
      proposal.taskId,
      (minutesByTask.get(proposal.taskId) ?? 0) + proposal.proposedMinutes,
    );
  }

  for (const task of inputs.tasks) {
    const remaining = getRemainingWorkMinutes(task);
    if (remaining == null) continue;

    const futureFocus = getFutureConfirmedFocusMinutesForTask(
      task,
      inputs.events,
      inputs.now,
    );
    const proposed = minutesByTask.get(task.id) ?? 0;

    assert(assertions, {
      id: `remaining-non-negative:${task.id}`,
      category: "task_allocation",
      severity: "critical",
      condition: remaining >= 0,
      message: `Remaining work for ${task.id} must never be negative`,
    });

    assert(assertions, {
      id: `proposed-lte-remaining:${task.id}`,
      category: "task_allocation",
      severity: "critical",
      condition: proposed <= remaining - futureFocus + 0.0001,
      message: `Proposed minutes for ${task.id} must not exceed remaining unplanned work`,
    });

    const estimate = getPlanningEstimateMinutes(task);
    if (estimate != null && task.estimatedMinutes != null) {
      assert(assertions, {
        id: `no-double-calibration:${task.id}`,
        category: "integrity",
        severity: "critical",
        condition:
          task.effectiveEstimateMinutes == null ||
          task.effectiveEstimateMinutes ===
            Math.round(
              task.estimatedMinutes * (task.calibrationMeta?.factor ?? 1),
            ) ||
          task.calibrationMeta == null ||
          task.calibrationMeta.factor === 1,
        message: `Calibration for ${task.id} must not be applied twice`,
      });
    }
  }

  for (const proposal of proposals) {
    if (proposal.explanation.calibration) {
      const cal = proposal.explanation.calibration;
      assert(assertions, {
        id: `calibration-provenance:${proposal.taskId}:${proposal.proposedStartAt}`,
        category: "integrity",
        severity: "major",
        condition:
          Number.isFinite(cal.factor) &&
          cal.sampleCount >= 0 &&
          cal.userEstimate > 0 &&
          cal.effectiveEstimate > 0,
        message: `Calibration provenance for ${proposal.taskId} must be complete`,
      });
    }

    if (proposal.explanation.splitRecommendation?.includes("split")) {
      const siblingCount = proposals.filter(
        (p) => p.taskId === proposal.taskId,
      ).length;
      assert(assertions, {
        id: `split-matches:${proposal.taskId}`,
        category: "explanation",
        severity: "major",
        condition: siblingCount >= 2,
        message: `Split explanation for ${proposal.taskId} requires multiple blocks`,
      });
    }
  }

  const overbooking =
    result.unscheduledMinutes < 0 ||
    (result.totalProposedMinutes > 0 &&
      result.unscheduledMinutes === 0 &&
      result.atRiskTaskIds.length > 0 &&
      result.partiallyScheduledTaskIds.length === 0 &&
      result.unschedulableTasks.length === 0);

  assert(assertions, {
    id: "capacity-honesty",
    category: "capacity",
    severity: "critical",
    condition: !overbooking && result.unscheduledMinutes >= 0,
    message: "Planner must not claim capacity for unmet work",
  });

  const acceptedPreserved = inputs.acceptedProposalIntervals.every(
    (accepted) =>
      !proposals.some((p) =>
        intervalsOverlap(
          p.proposedStartAt,
          p.proposedEndAt,
          accepted.startAt,
          accepted.endAt,
        ),
      ),
  );

  assert(assertions, {
    id: "preserve-accepted-blocks",
    category: "feasibility",
    severity: "critical",
    condition: acceptedPreserved,
    message: "Accepted planning blocks must not be overwritten by new proposals",
  });

  for (const event of inputs.events) {
    if (event.source === "canvas" || event.source === "microsoft" || event.source === "google") {
      assert(assertions, {
        id: `source-managed-untouched:${event.id}`,
        category: "feasibility",
        severity: "critical",
        condition: true,
        message: `Source-managed event ${event.id} is never moved by planner`,
      });
    }
  }

  for (const proposal of proposals) {
    const localStart = getAppLocalDateKey(proposal.proposedStartAt);
    assert(assertions, {
      id: `timezone-datekey:${proposal.taskId}:${proposal.proposedStartAt}`,
      category: "feasibility",
      severity: "critical",
      condition: inputs.dayKeys.includes(localStart),
      message: `Proposal local day ${localStart} must fall in planning dayKeys`,
    });
  }

  const criticalFailures = assertions.filter(
    (a) => !a.passed && a.severity === "critical",
  );
  const passCount = assertions.filter((a) => a.passed).length;
  const failCount = assertions.length - passCount;

  return {
    assertions,
    criticalFailures,
    passCount,
    failCount,
    passRate: assertions.length === 0 ? 1 : passCount / assertions.length,
  };
}

export function proposalsAreDeterministic(
  a: FocusBlockProposal[],
  b: FocusBlockProposal[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.taskId !== right.taskId ||
      left.proposedStartAt !== right.proposedStartAt ||
      left.proposedEndAt !== right.proposedEndAt ||
      left.proposedMinutes !== right.proposedMinutes ||
      left.explanation.reason !== right.explanation.reason
    ) {
      return false;
    }
  }
  return true;
}
