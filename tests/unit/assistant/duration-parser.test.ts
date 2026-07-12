import { describe, expect, it } from "vitest";
import { parseDurationMinutes } from "@/lib/assistant/duration-parser";

describe("duration-parser", () => {
  it("parses minutes", () => {
    expect(parseDurationMinutes("90 minutes")).toBe(90);
    expect(parseDurationMinutes("find 45 minute opening")).toBe(45);
  });

  it("parses hours", () => {
    expect(parseDurationMinutes("two hours")).toBe(120);
    expect(parseDurationMinutes("an hour")).toBe(60);
    expect(parseDurationMinutes("2-hour")).toBe(120);
  });
});
