import { describe, expect, it } from "vitest";
import { candidateFingerprint, previewSuppressionUids } from "@/lib/data/academic/canvas-links";
import type { CanvasMeetingCandidate } from "@/lib/academic/canvas-candidates";

const candidate: CanvasMeetingCandidate = {
  id: "cis 501:09:30:10:45",
  courseCode: "CIS 501",
  title: "CIS 501 Algorithms",
  daysOfWeek: [1, 3],
  startTime: "09:30",
  endTime: "10:45",
  effectiveStartDate: "2026-08-24",
  effectiveEndDate: "2026-12-11",
  location: null,
  confidence: "high",
  reason: "Recurring",
  sourceCanvasUids: ["uid-1", "uid-2", "uid-3"],
  occurrenceCount: 3,
};

describe("canvas suppression", () => {
  it("uses stable uid list for suppression preview", () => {
    expect(previewSuppressionUids(candidate)).toEqual([
      "uid-1",
      "uid-2",
      "uid-3",
    ]);
  });

  it("builds stable candidate fingerprint", () => {
    expect(candidateFingerprint(candidate)).toBe(candidate.id);
  });
});
