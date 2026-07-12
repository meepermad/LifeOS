import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseCommand } from "@/lib/assistant/parser";
import { tryAiIntentRouter } from "@/lib/assistant/ai-intent-router/router";

vi.mock("@/lib/assistant/ai-intent-router/router", () => ({
  tryAiIntentRouter: vi.fn(),
}));

describe("deterministic-first ai fallback", () => {
  beforeEach(() => {
    vi.mocked(tryAiIntentRouter).mockReset();
  });

  it("deterministic match should not require AI", () => {
    const result = parseCommand("show my workload this week", new Date("2026-07-12"));
    expect(result.kind).toBe("command");
    expect(tryAiIntentRouter).not.toHaveBeenCalled();
  });

  it("unknown phrase can be routed by AI when enabled", async () => {
    vi.mocked(tryAiIntentRouter).mockResolvedValue({
      attempted: true,
      parseResult: {
        kind: "command",
        command: { intent: "show_next_class" },
      },
      intent: "show_next_class",
    });

    const aiResult = await tryAiIntentRouter({
      message: "when is my next lecture thing",
      userId: "user-1",
    });

    expect(aiResult.attempted).toBe(true);
    if (aiResult.attempted && aiResult.parseResult.kind === "command") {
      expect(aiResult.parseResult.command.intent).toBe("show_next_class");
    }
  });
});
