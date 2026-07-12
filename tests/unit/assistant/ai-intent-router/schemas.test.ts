import { describe, expect, it } from "vitest";
import {
  intentRouterResultSchema,
  validateIntentRouterResult,
} from "@/lib/assistant/ai-intent-router/schemas";
import { ALLOWED_INTENTS } from "@/lib/assistant/ai-intent-router/allowlist";

const validMatched = {
  schemaVersion: 1 as const,
  status: "matched" as const,
  intent: "schedule_summary",
  confidence: 0.92,
  range: { kind: "calendar_week", offset: 1 },
  entities: {},
  clarificationQuestion: null,
};

describe("intent router schemas", () => {
  it("accepts valid structured output", () => {
    expect(intentRouterResultSchema.safeParse(validMatched).success).toBe(true);
  });

  it("rejects unknown properties", () => {
    const result = intentRouterResultSchema.safeParse({
      ...validMatched,
      extra: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown intent when matched", () => {
    const result = validateIntentRouterResult(
      { ...validMatched, intent: "delete_database" },
      ALLOWED_INTENTS,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects confidence outside 0-1", () => {
    const result = intentRouterResultSchema.safeParse({
      ...validMatched,
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects arbitrary UUID entities", () => {
    const result = validateIntentRouterResult(
      {
        ...validMatched,
        intent: "create_task",
        entities: {
          taskId: "11111111-1111-1111-1111-111111111111",
          title: "Read chapter 3",
        },
      },
      ALLOWED_INTENTS,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects contradictory date range", () => {
    const result = validateIntentRouterResult(
      {
        ...validMatched,
        range: {
          kind: "explicit",
          startDate: "2026-07-20",
          endDate: "2026-07-10",
        },
      },
      ALLOWED_INTENTS,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts clarification result", () => {
    const result = validateIntentRouterResult(
      {
        schemaVersion: 1,
        status: "clarification_required",
        intent: "schedule_summary",
        confidence: 0.6,
        range: null,
        entities: {},
        clarificationQuestion: "Which Monday do you mean?",
      },
      ALLOWED_INTENTS,
    );
    expect(result.ok).toBe(true);
  });
});
