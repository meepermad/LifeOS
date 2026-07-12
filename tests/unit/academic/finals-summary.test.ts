import { describe, expect, it } from "vitest";
import { buildFinalsWeekSummary } from "@/lib/academic/finals-summary";

describe("finals week summary", () => {
  it("lists finals and notes missing courses", () => {
    const content = buildFinalsWeekSummary({
      label: "Finals Week",
      startDateKey: "2026-12-14",
      endDateKey: "2026-12-18",
      courses: [
        { id: "c1", code: "CIS 501", name: "Algorithms" } as never,
        { id: "c2", code: "MATH 220", name: "Calculus" } as never,
      ],
      events: [
        {
          id: "f1",
          title: "CIS 501 Final Exam",
          start_at: "2026-12-15T19:00:00.000Z",
          end_at: "2026-12-15T21:00:00.000Z",
          event_type: "exam",
          status: "confirmed",
          all_day: false,
        } as never,
      ],
      tasks: [
        { title: "Project due", due_at: "2026-12-16T05:00:00.000Z" },
      ],
    });

    expect(content).toContain("Finals Week runs");
    expect(content).toContain("CIS 501");
    expect(content).toContain("No final recorded");
    expect(content).toContain("Assignment deadlines during finals");
    expect(content).toContain("Project due");
  });
});
