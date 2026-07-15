import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import { evaluatePlannerInvariants } from "@/lib/planning/invariants";
import { buildPlanningInput } from "./build-input";
import {
  buildScorecard,
  compareExpectations,
  scorecardTotal,
  verifyDeterminism,
  verifyDeterminism100,
  verifyIdempotentAccept,
} from "./scorecard";
import type {
  BenchmarkResults,
  PlannerScenario,
  ScenarioRunResult,
} from "./types";

const ARTIFACTS_PATH = join(
  process.cwd(),
  "artifacts",
  "planner-benchmark-results.json",
);

export function runScenario(scenario: PlannerScenario): ScenarioRunResult {
  const plannerInput = buildPlanningInput(scenario);
  const result = generatePlanningProposals(plannerInput);
  const invariantReport = evaluatePlannerInvariants({
    inputs: plannerInput,
    result,
  });

  let deterministicMatch = true;
  if (scenario.expected.requireDeterministic) {
    if (scenario.expected.customChecks?.includes("determinism-100")) {
      deterministicMatch = verifyDeterminism100(
        generatePlanningProposals,
        plannerInput,
      );
    } else {
      deterministicMatch = verifyDeterminism(generatePlanningProposals, plannerInput);
    }
  }

  const idempotentAcceptOk = scenario.expected.requireIdempotentAccept
    ? verifyIdempotentAccept(result)
    : true;

  const expectationFailures = compareExpectations({
    scenario,
    plannerInput,
    result,
    invariantReport,
    deterministicMatch,
    idempotentAcceptOk,
  });

  const scorecard = buildScorecard({
    scenario,
    plannerInput,
    result,
    invariantReport,
    expectationFailures,
    deterministicMatch,
    idempotentAcceptOk,
  });
  const { total, max } = scorecardTotal(scorecard);

  const criticalFailures = [
    ...invariantReport.criticalFailures.map((f) => f.message),
    ...expectationFailures.map((f) => `[${f.check}] ${f.message}`),
  ];

  const passed =
    invariantReport.criticalFailures.length === 0 &&
    expectationFailures.length === 0;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    passed,
    criticalFailures,
    expectationFailures,
    invariantReport: {
      passCount: invariantReport.passCount,
      failCount: invariantReport.failCount,
      passRate: invariantReport.passRate,
      criticalFailureMessages: invariantReport.criticalFailures.map(
        (f) => f.message,
      ),
    },
    scorecard,
    scoreTotal: total,
    scoreMax: max,
    summary: {
      proposalCount: result.proposals.length,
      totalProposedMinutes: result.totalProposedMinutes,
      unscheduledMinutes: result.unscheduledMinutes,
      atRiskTaskIds: result.atRiskTaskIds,
      unschedulableTaskIds: result.unschedulableTasks.map((t) => t.taskId),
    },
  };
}

export function runAllScenarios(
  scenarios: PlannerScenario[],
): BenchmarkResults {
  const results = scenarios.map(runScenario);
  const passedCount = results.filter((r) => r.passed).length;

  return {
    runAt: new Date().toISOString(),
    scenarioCount: scenarios.length,
    passedCount,
    failedCount: scenarios.length - passedCount,
    results,
  };
}

export function writeResults(
  results: BenchmarkResults,
  outputPath = ARTIFACTS_PATH,
): void {
  mkdirSync(join(outputPath, ".."), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
}

export function printResults(results: BenchmarkResults): void {
  for (const result of results.results) {
    const status = result.passed ? "PASS" : "FAIL";
    const score = `${result.scoreTotal}/${result.scoreMax}`;
    console.log(
      `${status} ${result.scenarioId} ${result.scenarioName} (${score})`,
    );
    if (!result.passed) {
      for (const failure of result.criticalFailures.slice(0, 5)) {
        console.log(`  - ${failure}`);
      }
      if (result.criticalFailures.length > 5) {
        console.log(
          `  ... and ${result.criticalFailures.length - 5} more failures`,
        );
      }
    }
  }
  console.log(
    `\nPlanner benchmark: ${results.passedCount}/${results.scenarioCount} passed`,
  );
}

export function runBenchmarkHarness(
  scenarios: PlannerScenario[],
  options: { writeArtifact?: boolean; print?: boolean } = {},
): BenchmarkResults {
  const { writeArtifact = true, print = true } = options;
  const results = runAllScenarios(scenarios);
  if (writeArtifact) writeResults(results);
  if (print) printResults(results);
  return results;
}

export { ARTIFACTS_PATH };
