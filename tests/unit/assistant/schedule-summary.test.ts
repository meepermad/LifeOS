import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/assistant/parser";
import { classifyParaphrase } from "@/lib/assistant/paraphrase";
import { buildScheduleSummary } from "@/lib/assistant/schedule-summary";

const NOW = new Date("2026-07-12T12:00:00-05:00");

describe("academic assistant parsing", () => {
  it("parses schedule summary paraphrases", () => {
    const result = parseCommand("What does next week look like?", NOW);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("schedule_summary");
    }
  });

  it("parses next class query", () => {
    const result = parseCommand("When is my next class?", NOW);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("show_next_class");
    }
  });

  it("parses fall break query", () => {
    const result = parseCommand("When is fall break?", NOW);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("query_academic_period");
    }
  });

  it("classifies workload paraphrase", () => {
    expect(classifyParaphrase("How busy am I next week?")).toBe("show_workload");
  });
});

describe("schedule-summary formatting", () => {
  it("produces overview and day breakdown", () => {
    const formatted = buildScheduleSummary({
      label: "next week",
      events: [
        {
          id: "1",
          title: "CIS 501",
          start_at: "2026-07-13T14:30:00.000Z",
          end_at: "2026-07-13T15:45:00.000Z",
          event_type: "class",
          all_day: false,
          blocks_time: true,
          status: "confirmed",
        } as never,
      ],
      tasks: [],
      startDateKey: "2026-07-06",
      endDateKey: "2026-07-12",
    });
    expect(formatted.content).toContain("Overview for next week");
    expect(formatted.content).toContain("Day by day");
  });
});
