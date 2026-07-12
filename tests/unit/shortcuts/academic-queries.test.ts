import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/assistant/parser";
import { isReadOnlyIntent } from "@/lib/assistant/executor";

const NOW = new Date("2026-07-12T12:00:00-05:00");
const OPTIONS = {
  timezone: "America/Chicago",
};

describe("shortcuts academic queries", () => {
  const commands = [
    "What does next week look like?",
    "When is my next class?",
    "What classes do I have tomorrow?",
    "When is fall break?",
    "Show my finals week",
  ];

  for (const text of commands) {
    it(`parses "${text}" as read-only`, () => {
      const result = parseCommand(text, NOW, OPTIONS);
      expect(result.kind).toBe("command");
      if (result.kind === "command") {
        expect(isReadOnlyIntent(result.command)).toBe(true);
      }
    });
  }

  it("returns command intent for workload next week", () => {
    const result = parseCommand("How busy will I be next week?", NOW, OPTIONS);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("show_workload");
    }
  });
});
