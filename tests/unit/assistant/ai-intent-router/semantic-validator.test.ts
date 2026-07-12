import { describe, expect, it } from "vitest";
import { validateSemanticIntentRouterResult } from "@/lib/assistant/ai-intent-router/semantic-validator";

const baseContext = {
  message: "what does next week look like",
  now: new Date("2026-07-12T12:00:00-05:00"),
  timezone: "America/Chicago",
  minConfidence: 0.7,
};

describe("semantic validator", () => {
  it("rejects low confidence", () => {
    const result = validateSemanticIntentRouterResult(
      {
        schemaVersion: 1,
        status: "matched",
        intent: "schedule_summary",
        confidence: 0.4,
        range: { kind: "calendar_week", offset: 1 },
        entities: {},
        clarificationQuestion: null,
      },
      baseContext,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("low_confidence");
  });

  it("accepts read intent with valid week range", () => {
    const result = validateSemanticIntentRouterResult(
      {
        schemaVersion: 1,
        status: "matched",
        intent: "schedule_summary",
        confidence: 0.9,
        range: { kind: "calendar_week", offset: 1 },
        entities: {},
        clarificationQuestion: null,
      },
      baseContext,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects write intent without enough preview data", () => {
    const result = validateSemanticIntentRouterResult(
      {
        schemaVersion: 1,
        status: "matched",
        intent: "create_event",
        confidence: 0.9,
        range: null,
        entities: { title: "Meeting" },
        clarificationQuestion: null,
      },
      { ...baseContext, message: "schedule a meeting" },
    );
    expect(result.ok).toBe(false);
  });
});
