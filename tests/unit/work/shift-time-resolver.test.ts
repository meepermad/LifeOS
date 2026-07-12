import { describe, expect, it } from "vitest";
import { resolveShiftTimeRange } from "@/lib/work/shift-time-resolver";

describe("resolveShiftTimeRange", () => {
  it("resolves 2–10 to afternoon/evening shift", () => {
    const result = resolveShiftTimeRange("2–10");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.value.startTime).toBe("14:00");
      expect(result.value.endTime).toBe("22:00");
      expect(result.value.isOvernight).toBe(false);
    }
  });

  it("resolves 10–6:30 to morning start", () => {
    const result = resolveShiftTimeRange("10–6:30");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.value.startTime).toBe("10:00");
      expect(result.value.endTime).toBe("18:30");
    }
  });

  it("resolves 8–4:30 to morning shift", () => {
    const result = resolveShiftTimeRange("8–4:30");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.value.startTime).toBe("08:00");
      expect(result.value.endTime).toBe("16:30");
    }
  });

  it("resolves explicit overnight shift", () => {
    const result = resolveShiftTimeRange("10 PM–6 AM");
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.value.isOvernight).toBe(true);
    }
  });

  it("asks for clarification on invalid input", () => {
    const result = resolveShiftTimeRange("sometime");
    expect(result.kind).toBe("clarification");
  });
});
