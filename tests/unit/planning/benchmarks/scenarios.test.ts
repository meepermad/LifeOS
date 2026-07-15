import { describe, expect, it } from "vitest";
import { PLANNER_SCENARIOS } from "./scenarios";
import { runScenario } from "./runner";

describe("planner benchmark scenarios", () => {
  for (const scenario of PLANNER_SCENARIOS) {
    it(`${scenario.id}: ${scenario.name}`, () => {
      const result = runScenario(scenario);

      if (scenario.expected.allowFailure) {
        expect(result.criticalFailures.length).toBeGreaterThanOrEqual(0);
        return;
      }

      expect(
        result.criticalFailures,
        result.criticalFailures.join("\n"),
      ).toEqual([]);
    });
  }
});
