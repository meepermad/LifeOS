import { describe, expect, it } from "vitest";
import { mapIntentRouterResultToParseResult } from "@/lib/assistant/ai-intent-router/mapper";

const context = {
  message: "what does next week look like",
  now: new Date("2026-07-12T12:00:00-05:00"),
  timezone: "America/Chicago",
  minConfidence: 0.7,
};

describe("intent router mapper", () => {
  it("maps read intent to ParsedCommand", () => {
    const result = mapIntentRouterResultToParseResult(
      {
        schemaVersion: 1,
        status: "matched",
        intent: "schedule_summary",
        confidence: 0.9,
        range: { kind: "calendar_week", offset: 1 },
        entities: {},
        clarificationQuestion: null,
      },
      context,
    );
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("schedule_summary");
    }
  });

  it("maps write intent without action confirmation fields", () => {
    const result = mapIntentRouterResultToParseResult(
      {
        schemaVersion: 1,
        status: "matched",
        intent: "create_task",
        confidence: 0.9,
        range: null,
        entities: { title: "Study for exam" },
        clarificationQuestion: null,
      },
      context,
    );
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("create_task");
      expect(result.command).not.toHaveProperty("actionId");
      expect(result.command).not.toHaveProperty("userId");
    }
  });

  it("maps clarification to ParseClarification", () => {
    const result = mapIntentRouterResultToParseResult(
      {
        schemaVersion: 1,
        status: "clarification_required",
        intent: "schedule_summary",
        confidence: 0.6,
        range: null,
        entities: {},
        clarificationQuestion: "Which Monday do you mean?",
      },
      context,
    );
    expect(result.kind).toBe("clarification");
  });
});
