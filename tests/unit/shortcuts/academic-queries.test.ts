import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/assistant/parser";
import { isReadOnlyIntent } from "@/lib/assistant/executor";

const NOW = new Date("2026-07-12T12:00:00-05:00");

describe("shortcuts academic queries", () => {
  it("treats academic read-only commands as immediately executable", () => {
    const commands = [
      "What does next week look like?",
      "When is my next class?",
      "What classes do I have tomorrow?",
    ];

    for (const text of commands) {
      const result = parseCommand(text, NOW);
      expect(result.kind).toBe("command");
      if (result.kind === "command") {
        expect(isReadOnlyIntent(result.command)).toBe(true);
      }
    }
  });
});
