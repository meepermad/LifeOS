import { describe, expect, it } from "vitest";
import { parseTimerCommands } from "@/lib/assistant/timer-parser";

describe("timer parser", () => {
  it("parses stop timer", () => {
    const result = parseTimerCommands("Stop my timer.");
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("stop_timer");
    }
  });

  it("parses start timer with task title", () => {
    const result = parseTimerCommands("Start a timer for my networking lab.");
    expect(result.kind).toBe("command");
    if (result.kind === "command" && result.command.intent === "start_timer") {
      expect(result.command.taskTitle).toContain("networking lab");
    }
  });

  it("parses analytics read command", () => {
    const result = parseTimerCommands("How accurate have my estimates been?");
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("show_estimate_accuracy");
    }
  });
});
