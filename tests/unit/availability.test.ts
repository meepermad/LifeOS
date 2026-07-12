import { describe, expect, it } from "vitest";
import { groupAvailabilityByDay } from "@/lib/data/availability";
import type { AvailabilityRuleRow } from "@/types/domain";

describe("groupAvailabilityByDay", () => {
  it("groups availability rules by weekday", () => {
    const rules: AvailabilityRuleRow[] = [
      {
        id: "1",
        user_id: "u1",
        day_of_week: 1,
        available_start: "08:00:00",
        available_end: "12:00:00",
        maximum_focus_minutes: null,
        preferred_block_minutes: null,
        is_enabled: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        user_id: "u1",
        day_of_week: 1,
        available_start: "14:00:00",
        available_end: "18:00:00",
        maximum_focus_minutes: null,
        preferred_block_minutes: null,
        is_enabled: true,
        created_at: "",
        updated_at: "",
      },
    ];

    const grouped = groupAvailabilityByDay(rules);
    expect(grouped.get(1)?.length).toBe(2);
    expect(grouped.get(0)).toBeUndefined();
  });
});
