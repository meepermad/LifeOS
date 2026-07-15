import { PLANNER_SCENARIOS } from "./scenarios";
import { runBenchmarkHarness, writeResults, runAllScenarios } from "./runner";
import type { BenchmarkResults } from "./types";

export async function main(options?: {
  writeArtifact?: boolean;
  print?: boolean;
}): Promise<BenchmarkResults> {
  return runBenchmarkHarness(PLANNER_SCENARIOS, {
    writeArtifact: options?.writeArtifact ?? true,
    print: options?.print ?? true,
  });
}

export { PLANNER_SCENARIOS, runAllScenarios, writeResults };
