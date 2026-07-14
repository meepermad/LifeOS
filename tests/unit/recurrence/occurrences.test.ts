import { describe, expect, it } from "vitest";
import {
  buildOccurrenceDueAt,
  generateOccurrencesForTemplate,
} from "@/lib/recurrence/occurrences";
import type { RecurrenceTemplate } from "@/lib/recurrence/types";

function makeTemplate(
  overrides: Partial<RecurrenceTemplate> = {},
): RecurrenceTemplate {
  return {
    id: "tpl-1",
    user_id: "user-1",
    title: "Test task",
    description: null,
    task_category: null,
    course_id: null,
    default_estimate_minutes: 30,
    default_priority: 3,
    default_difficulty: 3,
    recurrence_rule: { frequency: "daily", interval: 1 },
    recurrence_timezone: "America/Chicago",
    first_occurrence_date: "2026-07-01",
    due_time: null,
    generation_horizon_days: 45,
    end_date: null,
    occurrence_limit: null,
    is_active: true,
    paused_at: null,
    archived_at: null,
    ended_at: null,
    future_edit_policy: "update_future_incomplete",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("generateOccurrencesForTemplate", () => {
  it("generates daily occurrences", () => {
    const result = generateOccurrencesForTemplate(makeTemplate(), {
      from: "2026-07-01",
      to: "2026-07-05",
    });
    expect(result).toHaveLength(5);
    expect(result[0]?.scheduledDate).toBe("2026-07-01");
  });

  it("generates weekdays only", () => {
    const result = generateOccurrencesForTemplate(
      makeTemplate({
        recurrence_rule: { frequency: "weekdays" },
        first_occurrence_date: "2026-07-06",
      }),
      { from: "2026-07-06", to: "2026-07-12" },
    );
    expect(result.map((o) => o.scheduledDate)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
    ]);
  });

  it("generates weekly on selected days", () => {
    const result = generateOccurrencesForTemplate(
      makeTemplate({
        recurrence_rule: { frequency: "weekly", interval: 1, byWeekday: [1, 4] },
        first_occurrence_date: "2026-07-06",
      }),
      { from: "2026-07-06", to: "2026-07-19" },
    );
    const dates = result.map((o) => o.scheduledDate);
    expect(dates).toContain("2026-07-06");
    expect(dates).toContain("2026-07-09");
    expect(dates).toContain("2026-07-13");
    expect(dates).toContain("2026-07-16");
  });

  it("clamps monthly day 31 to shorter months", () => {
    const result = generateOccurrencesForTemplate(
      makeTemplate({
        recurrence_rule: {
          frequency: "monthly",
          monthlyMode: "day_of_month",
          dayOfMonth: 31,
        },
        first_occurrence_date: "2026-01-31",
      }),
      { from: "2026-01-01", to: "2026-03-31" },
    );
    const dates = result.map((o) => o.scheduledDate);
    expect(dates).toContain("2026-01-31");
    expect(dates).toContain("2026-02-28");
    expect(dates).toContain("2026-03-31");
  });

  it("generates last Friday of month", () => {
    const result = generateOccurrencesForTemplate(
      makeTemplate({
        recurrence_rule: {
          frequency: "monthly",
          monthlyMode: "ordinal_weekday",
          ordinal: -1,
          weekday: 5,
        },
        first_occurrence_date: "2026-07-01",
      }),
      { from: "2026-07-01", to: "2026-08-31" },
    );
    expect(result[0]?.scheduledDate).toBe("2026-07-31");
    expect(result[1]?.scheduledDate).toBe("2026-08-28");
  });

  it("respects end date", () => {
    const result = generateOccurrencesForTemplate(
      makeTemplate({ end_date: "2026-07-03" }),
      { from: "2026-07-01", to: "2026-07-10" },
    );
    expect(result).toHaveLength(3);
  });

  it("does not apply lifetime occurrence_limit in the pure generator window", () => {
    const result = generateOccurrencesForTemplate(
      makeTemplate({ occurrence_limit: 3 }),
      { from: "2026-07-01", to: "2026-07-10" },
    );
    expect(result.length).toBeGreaterThan(3);
  });

  it("returns empty when paused", () => {
    const result = generateOccurrencesForTemplate(
      makeTemplate({ is_active: false, paused_at: "2026-07-01T00:00:00Z" }),
      { from: "2026-07-01", to: "2026-07-10" },
    );
    expect(result).toHaveLength(0);
  });

  it("skips exception dates", () => {
    const result = generateOccurrencesForTemplate(makeTemplate(), {
      from: "2026-07-01",
      to: "2026-07-05",
      exceptions: [
        {
          id: "ex-1",
          template_id: "tpl-1",
          occurrence_date: "2026-07-03",
          exception_type: "skipped",
          moved_to_date: null,
          override_title: null,
          override_estimate_minutes: null,
        },
      ],
    });
    expect(result.map((o) => o.scheduledDate)).not.toContain("2026-07-03");
    expect(result).toHaveLength(4);
  });

  it("moves occurrence to new date", () => {
    const result = generateOccurrencesForTemplate(makeTemplate(), {
      from: "2026-07-01",
      to: "2026-07-10",
      exceptions: [
        {
          id: "ex-1",
          template_id: "tpl-1",
          occurrence_date: "2026-07-03",
          exception_type: "moved",
          moved_to_date: "2026-07-05",
          override_title: null,
          override_estimate_minutes: null,
        },
      ],
    });
    const moved = result.find((o) => o.occurrenceKey === "2026-07-03");
    expect(moved?.scheduledDate).toBe("2026-07-05");
  });
});

describe("buildOccurrenceDueAt", () => {
  it("uses end of day when no due time", () => {
    const due = buildOccurrenceDueAt("2026-07-14", null, "America/Chicago");
    expect(due).toBeTruthy();
    expect(new Date(due).getTime()).toBeGreaterThan(0);
  });

  it("applies due time in timezone", () => {
    const due = buildOccurrenceDueAt(
      "2026-07-14",
      "09:00",
      "America/Chicago",
    );
    expect(due).toContain("T");
  });
});
