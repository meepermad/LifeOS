import { describe, expect, it } from "vitest";
import { parseDateRange, getCalendarWeekBounds, extractDatePhrase } from "@/lib/dates/range-parser";

const REF = new Date("2026-07-12T12:00:00-05:00");

describe("range-parser", () => {
  it("parses today, tomorrow, yesterday", () => {
    expect(parseDateRange("today", { now: REF })?.label).toBe("today");
    expect(parseDateRange("tomorrow", { now: REF })?.label).toBe("tomorrow");
    expect(parseDateRange("yesterday", { now: REF })?.label).toBe("yesterday");
  });

  it("parses week phrases with Monday start", () => {
    const thisWeek = parseDateRange("this week", { now: REF });
    expect(thisWeek?.kind).toBe("week");
    const bounds = getCalendarWeekBounds(REF, 0);
    expect(thisWeek?.start.toISOString()).toBe(bounds.start.toISOString());

    expect(parseDateRange("next week", { now: REF })?.label).toBe("next week");
    expect(parseDateRange("last week", { now: REF })?.label).toBe("last week");
    expect(parseDateRange("week after next", { now: REF })?.label).toBe(
      "week after next",
    );
  });

  it("parses rolling and weekend phrases", () => {
    expect(parseDateRange("next seven days", { now: REF })?.kind).toBe("rolling");
    expect(parseDateRange("this weekend", { now: REF })?.kind).toBe("weekend");
    expect(parseDateRange("next weekend", { now: REF })?.kind).toBe("weekend");
  });

  it("parses month phrases", () => {
    expect(parseDateRange("this month", { now: REF })?.kind).toBe("month");
    expect(parseDateRange("next month", { now: REF })?.kind).toBe("month");
  });

  it("parses explicit ISO date", () => {
    const range = parseDateRange("2026-08-24", { now: REF });
    expect(range?.kind).toBe("explicit");
    expect(range?.label).toBe("2026-08-24");
  });

  it("parses weekday names", () => {
    const friday = parseDateRange("Friday", { now: REF });
    expect(friday?.kind).toBe("day");
    expect(friday?.label).toBe("friday");
  });

  it("extracts date phrases from mixed text", () => {
    expect(extractDatePhrase("what does next week look like")).toBe("next week");
    expect(extractDatePhrase("when is fall break")).toBe("fall break");
  });

  it("uses Monday-Sunday week boundaries", () => {
    const bounds = getCalendarWeekBounds(REF, 0);
    expect(bounds.startKey).toBe("2026-07-06");
    expect(bounds.endKey).toBe("2026-07-12");
  });
});
