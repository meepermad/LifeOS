import { describe, expect, it } from "vitest";
import { main } from "./run-benchmark-cli";
import { PLANNER_SCENARIOS } from "./scenarios";

describe("run-benchmark-cli", () => {
  it("writes planner benchmark artifact", async () => {
    const results = await main({ writeArtifact: true, print: false });
    expect(results.scenarioCount).toBe(PLANNER_SCENARIOS.length);
    expect(results.results.length).toBe(PLANNER_SCENARIOS.length);
  });
});
