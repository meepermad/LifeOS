import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/assistant/parser";
import { validateParsedCommand } from "@/lib/assistant/schemas";

const REFERENCE = new Date("2026-07-13T12:00:00.000Z"); // Monday in Chicago context

describe("assistant parser", () => {
  it("parses agenda today", () => {
    const result = parseCommand("What do I have today?", REFERENCE);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("show_agenda");
      expect(result.command).toMatchObject({ scope: "today" });
    }
  });

  it("parses agenda tomorrow", () => {
    const result = parseCommand("What does tomorrow look?", REFERENCE);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("show_agenda");
      expect(result.command).toMatchObject({ scope: "tomorrow" });
    }
  });

  it("parses workload this week", () => {
    const result = parseCommand("Show my workload this week", REFERENCE);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command).toMatchObject({
        intent: "show_workload",
        scope: "week",
      });
    }
  });

  it("parses availability with duration", () => {
    const result = parseCommand("Find 90 minutes before Thursday", REFERENCE);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command).toMatchObject({
        intent: "find_availability",
        durationMinutes: 90,
      });
    }
  });

  it("parses plan today and week", () => {
    const today = parseCommand("Plan today", REFERENCE);
    expect(today.kind).toBe("command");
    if (today.kind === "command") {
      expect(today.command).toMatchObject({
        intent: "generate_plan",
        periodType: "day",
      });
    }

    const week = parseCommand("Generate a plan for this week", REFERENCE);
    expect(week.kind).toBe("command");
    if (week.kind === "command") {
      expect(week.command).toMatchObject({
        intent: "generate_plan",
        periodType: "week",
      });
    }
  });

  it("parses event title date and time", () => {
    const result = parseCommand(
      "Schedule a dentist appointment Tuesday from 3 to 4 PM",
      REFERENCE,
    );
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("create_event");
      const cmd = validateParsedCommand(result.command);
      expect(cmd.intent).toBe("create_event");
      if (cmd.intent === "create_event") {
        expect(cmd.title.toLowerCase()).toContain("dentist");
        expect(cmd.dateKey).toBeTruthy();
        expect(cmd.startTime).toBeTruthy();
        expect(cmd.endTime).toBeTruthy();
      }
    }
  });

  it("parses task due date and duration", () => {
    const result = parseCommand(
      "Add a two-hour task called Statistics Homework due Thursday",
      REFERENCE,
    );
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command.intent).toBe("create_task");
      const cmd = validateParsedCommand(result.command);
      if (cmd.intent === "create_task") {
        expect(cmd.title.toLowerCase()).toContain("statistics");
        expect(cmd.estimatedMinutes).toBe(120);
        expect(cmd.dueDateKey).toBeTruthy();
      }
    }
  });

  it("parses complete task", () => {
    const result = parseCommand("Complete Network Security Lab 4", REFERENCE);
    expect(result.kind).toBe("command");
    if (result.kind === "command") {
      expect(result.command).toMatchObject({
        intent: "complete_task",
        taskTitle: expect.stringContaining("Network Security"),
      });
    }
  });

  it("returns unknown for unsupported command", () => {
    const result = parseCommand("Tell me a joke", REFERENCE);
    expect(result.kind).toBe("unknown");
  });

  it("requests clarification for missing duration", () => {
    const result = parseCommand("When am I free tomorrow afternoon?", REFERENCE);
    expect(result.kind).toBe("clarification");
    if (result.kind === "clarification") {
      expect(result.missingField).toBe("duration");
    }
  });

  it("parses help and clear chat", () => {
    expect(parseCommand("help", REFERENCE).kind).toBe("command");
    expect(parseCommand("clear chat", REFERENCE).kind).toBe("command");
  });
});
