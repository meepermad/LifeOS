import { describe, expect, it } from "vitest";
import { parseShowWorkHours, parseShowWorkSchedule } from "@/lib/assistant/work-schedule-parser";

const REFERENCE = new Date("2026-07-13T12:00:00-05:00");

describe("work schedule parser", () => {
  it("parses show work schedule this week", () => {
    const result = parseShowWorkSchedule("Show my work schedule this week", REFERENCE);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("show_work_schedule");
    }
  });

  it("parses work hours question", () => {
    const result = parseShowWorkHours("How many hours am I working this week?");
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("show_work_hours");
    }
  });
});
