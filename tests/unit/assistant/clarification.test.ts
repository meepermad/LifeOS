import { describe, expect, it } from "vitest";
import { mergeClarification } from "@/lib/assistant/clarification";
import type { ClarificationState } from "@/lib/assistant/intents";

describe("clarification", () => {
  it("completes event duration follow-up", () => {
    const state: ClarificationState = {
      intent: "find_availability",
      partialPayload: { intent: "find_availability" },
      missingFields: ["duration"],
      originatingMessageId: "msg-1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const result = mergeClarification(state, "Two hours");
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command).toMatchObject({
        intent: "find_availability",
        durationMinutes: 120,
      });
    }
  });

  it("completes due date follow-up for task", () => {
    const state: ClarificationState = {
      intent: "create_task",
      partialPayload: {
        intent: "create_task",
        title: "Lab report",
      },
      missingFields: ["dueDate"],
      originatingMessageId: "msg-2",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const result = mergeClarification(
      state,
      "Sunday",
      new Date("2026-07-13T17:00:00.000Z"),
    );
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("create_task");
    }
  });
});
