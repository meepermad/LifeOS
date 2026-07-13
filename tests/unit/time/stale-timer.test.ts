import { describe, expect, it } from "vitest";
import { isStaleTimer } from "@/lib/time/stale-timer";
import type { ActiveTimerState } from "@/lib/data/time-entries";

function makeActive(startedAt: string): ActiveTimerState {
  return {
    entry: {
      id: "e1",
      user_id: "u1",
      task_id: "t1",
      task_title_snapshot: "Task",
      started_at: startedAt,
      ended_at: null,
      duration_seconds: null,
      entry_source: "timer",
      note: null,
      parent_entry_id: null,
      review_state: "valid",
      review_reason: null,
      reviewed_at: null,
      created_at: startedAt,
      updated_at: startedAt,
    },
    pauseSegments: [],
    isPaused: false,
    elapsedSeconds: 0,
  };
}

describe("stale-timer", () => {
  it("is stale after threshold hours", () => {
    const now = new Date("2026-07-12T14:00:00.000Z");
    const active = makeActive("2026-07-12T08:00:00.000Z");
    expect(isStaleTimer(active, 4, now)).toBe(true);
    expect(isStaleTimer(active, 7, now)).toBe(false);
  });
});
