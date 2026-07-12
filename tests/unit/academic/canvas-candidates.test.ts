import { describe, expect, it } from "vitest";
import { classifyCanvasMeetingCandidates } from "@/lib/academic/canvas-candidates";
import type { EventWithCalendar } from "@/lib/data/events";

function makeClassEvent(
  uid: string,
  title: string,
  startAt: string,
  endAt: string,
): EventWithCalendar {
  return {
    id: uid,
    external_event_id: uid,
    title,
    start_at: startAt,
    end_at: endAt,
    event_type: "class",
    status: "confirmed",
    all_day: false,
    blocks_time: true,
    calendar_id: "canvas",
    calendar_name: "Canvas",
    source: "canvas",
    is_read_only: true,
  } as EventWithCalendar;
}

describe("canvas-candidates", () => {
  it("classifies recurring canvas classes", () => {
    const events = [
      makeClassEvent("u1", "CIS 501 Lecture", "2026-08-24T19:30:00.000Z", "2026-08-24T20:45:00.000Z"),
      makeClassEvent("u2", "CIS 501 Lecture", "2026-08-26T19:30:00.000Z", "2026-08-26T20:45:00.000Z"),
      makeClassEvent("u3", "CIS 501 Lecture", "2026-08-31T19:30:00.000Z", "2026-08-31T20:45:00.000Z"),
    ];
    const candidates = classifyCanvasMeetingCandidates({
      canvasClassEvents: events,
      linkedCanvasUids: new Set(),
      existingSchoolEvents: [],
    });
    expect(candidates.length).toBe(1);
    expect(candidates[0].confidence).toBe("high");
    expect(candidates[0].courseCode).toBe("CIS 501");
  });
});
