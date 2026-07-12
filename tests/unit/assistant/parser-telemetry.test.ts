import { describe, expect, it } from "vitest";
import { telemetryFromCommand } from "@/lib/assistant/parser-telemetry";

describe("parser telemetry privacy", () => {
  it("logs only kind and offset for week commands", () => {
    const telemetry = telemetryFromCommand({
      intent: "schedule_summary",
      range: { phrase: "next week" },
    });
    expect(telemetry).toEqual({
      dateRangeKind: "week",
      weekOffset: 1,
    });
  });

  it("distinguishes rolling next seven days from week", () => {
    const rolling = telemetryFromCommand({
      intent: "schedule_summary",
      range: { phrase: "next seven days" },
    });
    const week = telemetryFromCommand({
      intent: "schedule_summary",
      range: { phrase: "next week" },
    });
    expect(rolling.dateRangeKind).toBe("rolling");
    expect(week.dateRangeKind).toBe("week");
  });

  it("does not include user content fields in telemetry shape", () => {
    const telemetry = telemetryFromCommand({
      intent: "show_classes",
      range: { phrase: "tomorrow" },
    });
    expect(telemetry).not.toHaveProperty("recognizedDatePhrase");
    expect(telemetry).not.toHaveProperty("message");
    expect(telemetry).not.toHaveProperty("title");
  });
});
