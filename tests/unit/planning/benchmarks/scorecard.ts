import { getUnscheduledRemainingMinutes } from "@/lib/planning/proposal-validation";
import { proposalsAreDeterministic } from "@/lib/planning/invariants";
import type { InvariantReport } from "@/lib/planning/invariants";
import type {
  PlanningGenerationResult,
  PlanningProposalInput,
} from "@/lib/planning/types";
import type {
  ExpectationFailure,
  PlannerScenario,
} from "./types";

export const SCORE_DIMENSIONS = [
  "feasibility",
  "deadlineCompliance",
  "capacityHonesty",
  "priorityRationality",
  "estimateCorrectness",
  "remainingWorkCorrectness",
  "fragmentationQuality",
  "preferenceCompliance",
  "historyPreservation",
  "explanationAccuracy",
  "determinism",
  "idempotency",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export type Scorecard = Record<ScoreDimension, number>;

function clampScore(value: number): number {
  return Math.max(0, Math.min(2, value));
}

function minutesByTask(
  result: PlanningGenerationResult,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const proposal of result.proposals) {
    map.set(
      proposal.taskId,
      (map.get(proposal.taskId) ?? 0) + proposal.proposedMinutes,
    );
  }
  return map;
}

function blockCountByTask(result: PlanningGenerationResult): Map<string, number> {
  const map = new Map<string, number>();
  for (const proposal of result.proposals) {
    map.set(proposal.taskId, (map.get(proposal.taskId) ?? 0) + 1);
  }
  return map;
}

function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return (
    new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(bStart).getTime() < new Date(aEnd).getTime()
  );
}

function collectReasonText(result: PlanningGenerationResult): string {
  const parts: string[] = [...result.warnings];
  for (const proposal of result.proposals) {
    parts.push(proposal.explanation.reason);
    parts.push(...proposal.explanation.preferenceMatches);
    parts.push(...proposal.explanation.preferenceViolations);
    if (proposal.explanation.splitRecommendation) {
      parts.push(proposal.explanation.splitRecommendation);
    }
    if (proposal.explanation.calibration?.reason) {
      parts.push(proposal.explanation.calibration.reason);
    }
  }
  for (const task of result.unschedulableTasks) {
    parts.push(task.reason);
  }
  return parts.join(" ").toLowerCase();
}

/** Property-based expectation checks (not exact slot matching). */
export function compareExpectations(input: {
  scenario: PlannerScenario;
  plannerInput: PlanningProposalInput;
  result: PlanningGenerationResult;
  invariantReport: InvariantReport;
  deterministicMatch?: boolean;
  idempotentAcceptOk?: boolean;
}): ExpectationFailure[] {
  const failures: ExpectationFailure[] = [];
  const { expected } = input.scenario;
  const { result, plannerInput } = input;
  const byTask = minutesByTask(result);
  const blocksByTask = blockCountByTask(result);

  for (const taskId of expected.mustSchedule ?? []) {
    if (!byTask.has(taskId) || (byTask.get(taskId) ?? 0) <= 0) {
      failures.push({
        check: "mustSchedule",
        message: `Expected task ${taskId} to be scheduled`,
      });
    }
  }

  for (const taskId of expected.mustNotSchedule ?? []) {
    if ((byTask.get(taskId) ?? 0) > 0) {
      failures.push({
        check: "mustNotSchedule",
        message: `Expected task ${taskId} not to be scheduled`,
      });
    }
  }

  for (const [taskId, minutes] of Object.entries(
    expected.totalMinutesByTask ?? {},
  )) {
    const actual = byTask.get(taskId) ?? 0;
    if (actual !== minutes) {
      failures.push({
        check: "totalMinutesByTask",
        message: `Task ${taskId}: expected ${minutes} proposed minutes, got ${actual}`,
      });
    }
  }

  for (const [taskId, latestEnd] of Object.entries(
    expected.latestEndByTask ?? {},
  )) {
    const latestMs = new Date(latestEnd).getTime();
    for (const proposal of result.proposals.filter((p) => p.taskId === taskId)) {
      if (new Date(proposal.proposedEndAt).getTime() > latestMs) {
        failures.push({
          check: "latestEndByTask",
          message: `Task ${taskId} block ends after ${latestEnd}`,
        });
      }
    }
  }

  for (const [taskId, maxBlocks] of Object.entries(
    expected.maximumBlockCountByTask ?? {},
  )) {
    const count = blocksByTask.get(taskId) ?? 0;
    if (count > maxBlocks) {
      failures.push({
        check: "maximumBlockCountByTask",
        message: `Task ${taskId}: expected at most ${maxBlocks} blocks, got ${count}`,
      });
    }
  }

  if (expected.minimumBlockMinutes != null) {
    for (const proposal of result.proposals) {
      if (proposal.proposedMinutes < expected.minimumBlockMinutes) {
        failures.push({
          check: "minimumBlockMinutes",
          message: `Block for ${proposal.taskId} is ${proposal.proposedMinutes} min (< ${expected.minimumBlockMinutes})`,
        });
      }
    }
  }

  if (expected.mustReportInsufficientCapacity) {
    const hasSignal =
      result.unscheduledMinutes > 0 ||
      result.atRiskTaskIds.length > 0 ||
      result.partiallyScheduledTaskIds.length > 0 ||
      result.unschedulableTasks.length > 0;
    if (!hasSignal) {
      failures.push({
        check: "mustReportInsufficientCapacity",
        message: "Expected insufficient-capacity signal (unmet work or at-risk tasks)",
      });
    }
  }

  if (
    expected.minimumUnscheduledMinutes != null &&
    result.unscheduledMinutes < expected.minimumUnscheduledMinutes
  ) {
    failures.push({
      check: "minimumUnscheduledMinutes",
      message: `Expected unscheduled >= ${expected.minimumUnscheduledMinutes}, got ${result.unscheduledMinutes}`,
    });
  }

  if (
    expected.maximumUnscheduledMinutes != null &&
    result.unscheduledMinutes > expected.maximumUnscheduledMinutes
  ) {
    failures.push({
      check: "maximumUnscheduledMinutes",
      message: `Expected unscheduled <= ${expected.maximumUnscheduledMinutes}, got ${result.unscheduledMinutes}`,
    });
  }

  const reasonText = collectReasonText(result);
  for (const fragment of expected.mustMentionReasons ?? []) {
    if (!reasonText.includes(fragment.toLowerCase())) {
      failures.push({
        check: "mustMentionReasons",
        message: `Expected reason text to mention "${fragment}"`,
      });
    }
  }

  if (
    expected.exactBlockCount != null &&
    result.proposals.length !== expected.exactBlockCount
  ) {
    failures.push({
      check: "exactBlockCount",
      message: `Expected ${expected.exactBlockCount} blocks, got ${result.proposals.length}`,
    });
  }

  for (const [taskId, count] of Object.entries(
    expected.exactBlockCountByTask ?? {},
  )) {
    const actual = blocksByTask.get(taskId) ?? 0;
    if (actual !== count) {
      failures.push({
        check: "exactBlockCountByTask",
        message: `Task ${taskId}: expected ${count} blocks, got ${actual}`,
      });
    }
  }

  for (const eventId of expected.noOverlapEventIds ?? []) {
    const event = plannerInput.events.find((e) => e.id === eventId);
    if (!event) continue;
    for (const proposal of result.proposals) {
      if (
        intervalsOverlap(
          proposal.proposedStartAt,
          proposal.proposedEndAt,
          event.startAt,
          event.endAt,
        )
      ) {
        failures.push({
          check: "noOverlapEventIds",
          message: `Proposal for ${proposal.taskId} overlaps event ${eventId}`,
        });
      }
    }
  }

  for (const taskId of expected.diagnosticsMustIncludeTaskIds ?? []) {
    const inUnschedulable = result.unschedulableTasks.some(
      (t) => t.taskId === taskId,
    );
    const inWarnings = result.warnings.some((w) =>
      w.toLowerCase().includes(taskId.toLowerCase()),
    );
    const task = plannerInput.tasks.find((t) => t.id === taskId);
    const titleMatch = task
      ? result.warnings.some((w) =>
          w.toLowerCase().includes(task.title.toLowerCase()),
        )
      : false;
    if (!inUnschedulable && !inWarnings && !titleMatch) {
      failures.push({
        check: "diagnosticsMustIncludeTaskIds",
        message: `Expected diagnostics to mention task ${taskId}`,
      });
    }
  }

  if (expected.requireDeterministic && input.deterministicMatch === false) {
    failures.push({
      check: "requireDeterministic",
      message: "Two identical runs produced different proposals",
    });
  }

  if (expected.requireIdempotentAccept && input.idempotentAcceptOk === false) {
    failures.push({
      check: "requireIdempotentAccept",
      message: "Accepting the same proposal hash twice would duplicate entries",
    });
  }

  if (expected.customChecks?.includes("at-risk-nonempty")) {
    if (result.atRiskTaskIds.length === 0) {
      failures.push({
        check: "at-risk-nonempty",
        message: "Expected at-risk task ids to be non-empty",
      });
    }
  }

  if (expected.customChecks?.includes("calibration-provenance")) {
    const hasProvenance = result.proposals.some(
      (p) => p.explanation.calibration != null,
    );
    if (!hasProvenance) {
      failures.push({
        check: "calibration-provenance",
        message: "Expected calibration provenance on proposal explanation",
      });
    }
  }

  return failures;
}

export function buildScorecard(input: {
  scenario: PlannerScenario;
  plannerInput: PlanningProposalInput;
  result: PlanningGenerationResult;
  invariantReport: InvariantReport;
  expectationFailures: ExpectationFailure[];
  deterministicMatch: boolean;
  idempotentAcceptOk: boolean;
}): Scorecard {
  const { scenario, plannerInput, result, invariantReport, expectationFailures } =
    input;
  const expected = scenario.expected;
  const byTask = minutesByTask(result);
  const blocksByTask = blockCountByTask(result);
  const criticalCount = invariantReport.criticalFailures.length;

  const feasibility =
    criticalCount === 0 && !expectationFailures.some((f) => f.check.startsWith("noOverlap"))
      ? 2
      : criticalCount === 0
        ? 1
        : 0;

  let deadlineCompliance = 2;
  for (const [taskId, latestEnd] of Object.entries(
    expected.latestEndByTask ?? {},
  )) {
    const latestMs = new Date(latestEnd).getTime();
    const bad = result.proposals
      .filter((p) => p.taskId === taskId)
      .some((p) => new Date(p.proposedEndAt).getTime() > latestMs);
    if (bad) deadlineCompliance = 0;
  }
  if (
    expectationFailures.some((f) => f.check === "latestEndByTask") &&
    deadlineCompliance > 0
  ) {
    deadlineCompliance = 0;
  }

  let capacityHonesty = 2;
  if (expected.mustReportInsufficientCapacity) {
    const ok =
      result.unscheduledMinutes > 0 ||
      result.atRiskTaskIds.length > 0 ||
      result.partiallyScheduledTaskIds.length > 0;
    capacityHonesty = ok ? 2 : 0;
  } else if (expected.maximumUnscheduledMinutes === 0 && result.unscheduledMinutes > 0) {
    capacityHonesty = 0;
  } else if (
    expected.minimumUnscheduledMinutes != null &&
    result.unscheduledMinutes < expected.minimumUnscheduledMinutes
  ) {
    capacityHonesty = 0;
  }

  let priorityRationality = 2;
  if (expectationFailures.some((f) => f.check === "mustSchedule")) {
    priorityRationality = 0;
  } else if (scenario.id === "S03" || scenario.id === "S24" || scenario.id === "S25") {
    const scheduledIds = new Set(result.proposals.map((p) => p.taskId));
    if (expected.mustSchedule?.every((id) => scheduledIds.has(id))) {
      priorityRationality = 2;
    } else {
      priorityRationality = 1;
    }
  }

  let estimateCorrectness = 2;
  for (const [taskId, minutes] of Object.entries(
    expected.totalMinutesByTask ?? {},
  )) {
    if ((byTask.get(taskId) ?? 0) !== minutes) estimateCorrectness = 0;
  }
  if (scenario.id === "S08") {
    const hasCalibration = result.proposals.some(
      (p) => p.explanation.calibration != null,
    );
    if (!hasCalibration) estimateCorrectness = Math.min(estimateCorrectness, 1);
  }
  if (scenario.id === "S09") {
    const task = plannerInput.tasks.find((t) => t.id.startsWith("task"));
    if (task && (byTask.get(task.id) ?? 0) > (task.estimatedMinutes ?? 0) + 5) {
      estimateCorrectness = 0;
    }
  }

  let remainingWorkCorrectness = 2;
  if (scenario.id === "S07") {
    const task = plannerInput.tasks[0];
    const unscheduled = getUnscheduledRemainingMinutes(
      task,
      plannerInput.events,
      plannerInput.now,
    );
    const proposed = byTask.get(task.id) ?? 0;
    if (unscheduled - proposed > 75 || unscheduled - proposed < 65) {
      remainingWorkCorrectness = 0;
    }
  }

  let fragmentationQuality = 2;
  for (const [taskId, maxBlocks] of Object.entries(
    expected.maximumBlockCountByTask ?? {},
  )) {
    if ((blocksByTask.get(taskId) ?? 0) > maxBlocks) fragmentationQuality = 0;
  }
  if (scenario.id === "S15") {
    const taskId = scenario.tasks[0]?.id ?? "task-frag";
    if ((blocksByTask.get(taskId) ?? 0) > 1) fragmentationQuality = 0;
  }
  if (scenario.id === "S16") {
    const taskId = scenario.tasks[0]?.id ?? "task-long";
    for (const proposal of result.proposals.filter((p) => p.taskId === taskId)) {
      if (proposal.proposedMinutes > 90) fragmentationQuality = 0;
    }
  }

  let preferenceCompliance = 2;
  if (scenario.preferences.avoidDifficultWorkAfter) {
    const cutoff = scenario.preferences.avoidDifficultWorkAfter;
    const difficultTask = plannerInput.tasks.find((t) => t.difficulty >= 4);
    if (difficultTask) {
      const late = result.proposals
        .filter((p) => p.taskId === difficultTask.id)
        .some((p) => p.proposedStartAt >= cutoff || p.proposedStartAt.includes("T01:"));
      if (late) preferenceCompliance = 0;
    }
  }
  if (scenario.preferences.minimumBreakMinutes && scenario.tasks.length >= 2) {
    const sorted = [...result.proposals].sort(
      (a, b) =>
        new Date(a.proposedStartAt).getTime() -
        new Date(b.proposedStartAt).getTime(),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      const gapMs =
        new Date(sorted[i].proposedStartAt).getTime() -
        new Date(sorted[i - 1].proposedEndAt).getTime();
      if (gapMs < scenario.preferences.minimumBreakMinutes * 60_000 - 1000) {
        preferenceCompliance = Math.min(preferenceCompliance, 1);
      }
    }
  }

  const historyPreservation = invariantReport.assertions.find(
    (a) => a.id === "preserve-accepted-blocks",
  )?.passed
    ? 2
    : 0;

  let explanationAccuracy = 2;
  if (expectationFailures.some((f) => f.check === "mustMentionReasons")) {
    explanationAccuracy = 0;
  }
  if (scenario.id === "S11") {
    const hasOverdue = result.proposals.some((p) =>
      p.explanation.reason.includes("overdue"),
    );
    if (!hasOverdue) explanationAccuracy = Math.min(explanationAccuracy, 1);
  }

  const determinism = expected.requireDeterministic
    ? input.deterministicMatch
      ? 2
      : 0
    : 2;

  const idempotency = expected.requireIdempotentAccept
    ? input.idempotentAcceptOk
      ? 2
      : 0
    : 2;

  return {
    feasibility: clampScore(feasibility),
    deadlineCompliance: clampScore(deadlineCompliance),
    capacityHonesty: clampScore(capacityHonesty),
    priorityRationality: clampScore(priorityRationality),
    estimateCorrectness: clampScore(estimateCorrectness),
    remainingWorkCorrectness: clampScore(remainingWorkCorrectness),
    fragmentationQuality: clampScore(fragmentationQuality),
    preferenceCompliance: clampScore(preferenceCompliance),
    historyPreservation: clampScore(historyPreservation),
    explanationAccuracy: clampScore(explanationAccuracy),
    determinism: clampScore(determinism),
    idempotency: clampScore(idempotency),
  };
}

export function scorecardTotal(scorecard: Scorecard): {
  total: number;
  max: number;
} {
  const values = SCORE_DIMENSIONS.map((d) => scorecard[d]);
  return {
    total: values.reduce((sum, v) => sum + v, 0),
    max: values.length * 2,
  };
}

export function verifyDeterminism(
  run: (input: PlanningProposalInput) => PlanningGenerationResult,
  input: PlanningProposalInput,
): boolean {
  const first = run(input);
  const second = run(input);
  return proposalsAreDeterministic(first.proposals, second.proposals);
}

export function verifyDeterminism100(
  run: (input: PlanningProposalInput) => PlanningGenerationResult,
  input: PlanningProposalInput,
): boolean {
  const baseline = run(input);
  for (let i = 0; i < 100; i += 1) {
    const next = run(input);
    if (!proposalsAreDeterministic(baseline.proposals, next.proposals)) {
      return false;
    }
  }
  return true;
}

export function verifyIdempotentAccept(
  result: PlanningGenerationResult,
): boolean {
  const accepted = new Set<string>();
  for (const proposal of result.proposals) {
    if (accepted.has(proposal.proposalHash)) {
      return false;
    }
    accepted.add(proposal.proposalHash);
    accepted.add(proposal.proposalHash);
  }
  return true;
}
