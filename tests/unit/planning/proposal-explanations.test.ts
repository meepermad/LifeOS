import { describe, expect, it } from "vitest";
import {
  buildProposalExplanation,
  formatProposalExplanation,
} from "@/lib/planning/proposal-explanations";

describe("proposal explanations", () => {
  it("builds structured explanation JSON", () => {
    const explanation = buildProposalExplanation({
      reason: "earliest_due_high_priority",
      dueAt: "2026-07-16T04:59:00.000Z",
      availableIntervalMinutes: 120,
      taskRemainingMinutes: 180,
      scheduledTaskMinutesBeforeProposal: 0,
      preferenceMatches: ["preferred_block_length"],
      preferenceViolations: [],
    });

    expect(explanation.reason).toBe("earliest_due_high_priority");
    expect(explanation.preferenceMatches).toContain("preferred_block_length");
  });

  it("formats human-readable explanation text", () => {
    const text = formatProposalExplanation(
      buildProposalExplanation({
        reason: "earliest_due_high_priority",
        dueAt: "2026-07-16T04:59:00.000Z",
        availableIntervalMinutes: 120,
        taskRemainingMinutes: 180,
        scheduledTaskMinutesBeforeProposal: 0,
        preferenceMatches: ["preferred_block_length"],
        preferenceViolations: [],
      }),
      "Essay draft",
    );

    expect(text).toContain("Essay draft");
    expect(text).toContain("preferred focus length");
  });
});
