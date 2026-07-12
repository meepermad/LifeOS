import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/assistant/parser";
import { getCalendarWeekBounds, parseDateRange } from "@/lib/dates/range-parser";

const TIMEZONE = "America/Chicago";
const SUNDAY_ANCHOR = new Date("2026-07-12T12:00:00-05:00");

const NEXT_WEEK_PHRASES = [
  "What does next week look like?",
  "What does my week look like next?",
  "What do I have going on next week?",
  "What is going on with me next week?",
  "Give me a rundown of next week.",
  "Show me the week ahead.",
  "What am I doing next week?",
  "How busy will I be next week?",
  "What does school look like next week?",
  "What do work and school look like next week?",
];

function parseOpts(now: Date) {
  return { now, timezone: TIMEZONE };
}

describe("academic parser phrase coverage", () => {
  for (const phrase of NEXT_WEEK_PHRASES) {
    it(`parses "${phrase}"`, () => {
      const result = parseCommand(phrase, SUNDAY_ANCHOR, parseOpts(SUNDAY_ANCHOR));
      expect(result.kind).toBe("command");
      if (result.kind !== "command") return;

      const intent = result.command.intent;
      if (phrase.toLowerCase().includes("how busy")) {
        expect(intent).toBe("show_workload");
      } else {
        expect(intent).toBe("schedule_summary");
      }

      if ("range" in result.command && result.command.range) {
        const bounds = getCalendarWeekBounds(SUNDAY_ANCHOR, 1, TIMEZONE);
        expect(result.command.range.startDateKey).toBe(bounds.startKey);
        expect(result.command.range.endDateKey).toBe(bounds.endKey);
      }
    });
  }

  it('parses "What is my schedule like the week after next?"', () => {
    const result = parseCommand(
      "What is my schedule like the week after next?",
      SUNDAY_ANCHOR,
      parseOpts(SUNDAY_ANCHOR),
    );
    expect(result.kind).toBe("command");
    if (result.kind === "command" && "range" in result.command) {
      const bounds = getCalendarWeekBounds(SUNDAY_ANCHOR, 2, TIMEZONE);
      expect(result.command.range?.startDateKey).toBe(bounds.startKey);
      expect(result.command.range?.endDateKey).toBe(bounds.endKey);
    }
  });

  it("distinguishes next seven days from next week", () => {
    const rolling = parseDateRange("What does the next seven days look like?", {
      now: SUNDAY_ANCHOR,
      timezone: TIMEZONE,
    });
    const week = parseDateRange("What does next week look like?", {
      now: SUNDAY_ANCHOR,
      timezone: TIMEZONE,
    });

    expect(rolling?.kind).toBe("rolling");
    expect(week?.kind).toBe("week");
    expect(rolling?.start.toISOString()).not.toBe(week?.start.toISOString());
    expect(rolling?.phrase).toBe("next seven days");
    expect(week?.phrase).toBe("next week");
  });

  it("uses Monday-Sunday boundaries for next week on Sunday anchor", () => {
    const bounds = getCalendarWeekBounds(SUNDAY_ANCHOR, 1, TIMEZONE);
    expect(bounds.startKey).toBe("2026-07-13");
    expect(bounds.endKey).toBe("2026-07-19");
  });

  it("handles DST spring-forward week in profile timezone", () => {
    const dstSunday = new Date("2026-03-08T12:00:00-05:00");
    const range = parseDateRange("next week", { now: dstSunday, timezone: TIMEZONE });
    expect(range?.kind).toBe("week");
    const bounds = getCalendarWeekBounds(dstSunday, 1, TIMEZONE);
    expect(range?.start.toISOString()).toBe(bounds.start.toISOString());
    expect(range?.end.toISOString()).toBe(bounds.end.toISOString());
  });

  it("handles DST fall-back week in profile timezone", () => {
    const dstSunday = new Date("2026-11-01T12:00:00-05:00");
    const range = parseDateRange("next week", { now: dstSunday, timezone: TIMEZONE });
    expect(range?.kind).toBe("week");
    const bounds = getCalendarWeekBounds(dstSunday, 1, TIMEZONE);
    expect(range?.start.toISOString()).toBe(bounds.start.toISOString());
  });
});
