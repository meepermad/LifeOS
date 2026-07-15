import type { PlanningTask } from "@/lib/planning/types";

/**
 * Pure remaining-work math used by the planner and audits.
 *
 * Planning estimate / remaining precedence:
 * 1. When remainingMinutes === estimatedMinutes and an adaptive estimate exists,
 *    use the adaptive estimate (calibration applies once).
 * 2. When remainingMinutes is set and differs from estimatedMinutes, treat
 *    remainingMinutes as the authoritative stored remaining (LifeOS system of
 *    record) and do not re-subtract tracked minutes.
 * 3. When remainingMinutes === estimatedMinutes (no adaptive), subtract tracked.
 * 4. Otherwise fall back to effective → estimated, subtracting tracked.
 *
 * Unscheduled remaining additionally subtracts future confirmed focus blocks
 * (and optional pending proposals).
 */
export function getPlanningEstimateMinutes(
  task: Pick<
    PlanningTask,
    "effectiveEstimateMinutes" | "estimatedMinutes" | "remainingMinutes"
  >,
): number | null {
  if (
    task.estimatedMinutes != null &&
    task.remainingMinutes != null &&
    task.remainingMinutes === task.estimatedMinutes &&
    task.effectiveEstimateMinutes != null
  ) {
    return task.effectiveEstimateMinutes;
  }
  if (task.remainingMinutes != null) return task.remainingMinutes;
  if (task.effectiveEstimateMinutes != null) {
    return task.effectiveEstimateMinutes;
  }
  if (task.estimatedMinutes != null) return task.estimatedMinutes;
  return null;
}

export function hasProgressAdjustedRemaining(
  task: Pick<PlanningTask, "estimatedMinutes" | "remainingMinutes">,
): boolean {
  return (
    task.remainingMinutes != null &&
    task.estimatedMinutes != null &&
    task.remainingMinutes < task.estimatedMinutes
  );
}

/** Remaining work before subtracting future planned focus. */
export function getRemainingWorkMinutes(
  task: Pick<
    PlanningTask,
    | "effectiveEstimateMinutes"
    | "estimatedMinutes"
    | "remainingMinutes"
    | "trackedMinutes"
  >,
): number | null {
  const tracked = task.trackedMinutes ?? 0;

  if (
    task.estimatedMinutes != null &&
    task.remainingMinutes != null &&
    task.remainingMinutes === task.estimatedMinutes &&
    task.effectiveEstimateMinutes != null
  ) {
    return Math.max(0, task.effectiveEstimateMinutes - tracked);
  }

  if (task.remainingMinutes != null) {
    if (
      task.estimatedMinutes != null &&
      task.remainingMinutes === task.estimatedMinutes
    ) {
      return Math.max(0, task.remainingMinutes - tracked);
    }
    return Math.max(0, task.remainingMinutes);
  }

  if (task.effectiveEstimateMinutes != null) {
    return Math.max(0, task.effectiveEstimateMinutes - tracked);
  }
  if (task.estimatedMinutes != null) {
    return Math.max(0, task.estimatedMinutes - tracked);
  }
  return null;
}

export function getUnscheduledRemainingWorkMinutes(
  task: Pick<
    PlanningTask,
    | "effectiveEstimateMinutes"
    | "estimatedMinutes"
    | "remainingMinutes"
    | "trackedMinutes"
  >,
  futureConfirmedFocusMinutes: number,
  pendingProposalMinutes = 0,
): number {
  const remaining = getRemainingWorkMinutes(task);
  if (remaining == null) return 0;
  return Math.max(
    0,
    remaining - futureConfirmedFocusMinutes - pendingProposalMinutes,
  );
}

export type RemainingWorkBreakdownPure = {
  originalEstimateMinutes: number | null;
  adaptiveEstimateMinutes: number | null;
  planningEstimateMinutes: number | null;
  trackedMinutes: number;
  plannedFutureMinutes: number;
  remainingWorkMinutes: number | null;
  unscheduledRemainingMinutes: number;
};

export function buildRemainingWorkBreakdown(input: {
  task: Pick<
    PlanningTask,
    | "estimatedMinutes"
    | "effectiveEstimateMinutes"
    | "remainingMinutes"
    | "trackedMinutes"
  >;
  plannedFutureMinutes: number;
  pendingProposalMinutes?: number;
}): RemainingWorkBreakdownPure {
  const { task, plannedFutureMinutes, pendingProposalMinutes = 0 } = input;
  const planningEstimateMinutes = getPlanningEstimateMinutes(task);
  const remainingWorkMinutes = getRemainingWorkMinutes(task);
  const unscheduledRemainingMinutes = getUnscheduledRemainingWorkMinutes(
    task,
    plannedFutureMinutes,
    pendingProposalMinutes,
  );

  return {
    originalEstimateMinutes: task.estimatedMinutes,
    adaptiveEstimateMinutes: task.effectiveEstimateMinutes ?? null,
    planningEstimateMinutes,
    trackedMinutes: task.trackedMinutes ?? 0,
    plannedFutureMinutes,
    remainingWorkMinutes,
    unscheduledRemainingMinutes,
  };
}
