import { describe, expect, it } from "vitest";
import { isAiIntentRouterEnabled } from "@/lib/assistant/ai-intent-router/feature-flag";

describe("ai intent router env", () => {
  it("disabled when env not set", () => {
    expect(isAiIntentRouterEnabled(undefined)).toBe(false);
  });
});
