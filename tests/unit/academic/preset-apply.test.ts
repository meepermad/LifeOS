import { describe, expect, it } from "vitest";
import { buildTermFromPreset, mergePresetExceptions } from "@/lib/academic/preset-apply";

describe("preset-apply", () => {
  it("builds K-State fall 2026 term", () => {
    const built = buildTermFromPreset({
      presetKey: "k-state-2026-2027",
      termKey: "fall-2026",
      importedAt: "2026-07-12T00:00:00.000Z",
    });
    expect(built?.term.name).toBe("Fall 2026");
    expect(built?.term.classes_start).toBe("2026-08-24");
    expect(built?.exceptions.some((e) => e.title === "Fall Break")).toBe(true);
  });

  it("does not overwrite user-modified exceptions", () => {
    const built = buildTermFromPreset({
      presetKey: "k-state-2026-2027",
      termKey: "spring-2027",
      importedAt: "2026-07-12T00:00:00.000Z",
    });
    const toInsert = mergePresetExceptions({
      existing: [
        {
          id: "1",
          user_id: "u",
          academic_term_id: "t",
          exception_type: "break",
          start_date: "2027-03-14",
          end_date: "2027-03-21",
          course_id: null,
          suppresses_classes: true,
          blocks_availability: false,
          informational_only: false,
          title: "Spring Break",
          notes: null,
          altered_schedule: null,
          preset_key: "spring-2027-break",
          is_user_modified: true,
          created_at: "",
          updated_at: "",
        },
      ],
      fromPreset: built?.exceptions ?? [],
    });
    expect(toInsert.find((e) => e.preset_key === "spring-2027-break")).toBeUndefined();
    expect(toInsert.length).toBeGreaterThan(0);
  });
});
