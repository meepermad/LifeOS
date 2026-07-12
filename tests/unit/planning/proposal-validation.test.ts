import { describe, expect, it } from "vitest";
import {
  eventsOverlapInterval,
  getUnscheduledRemainingMinutes,
  validateProposalForAcceptance,
} from "@/lib/planning/proposal-validation";
import { computeProposalHash } from "@/lib/planning/proposal-hash";
import { defaultPlanningPreferences, planningEvent } from "./helpers";
import type { PlanningTask } from "@/lib/planning/types";

const task: PlanningTask = {
  id: "task-1",
  title: "Essay",
  status: "open",
  dueAt: "2026-07-16T04:59:00.000Z",
  earliestStartAt: null,
  estimatedMinutes: 120,
  remainingMinutes: 120,
  priority: 2,
  difficulty: 3,
  splittable: true,
  minimumBlockMinutes: 25,
  source: "manual",
  relatedEventId: null,
};

describe("proposal validation", () => {
  it("detects overlapping events", () => {
    const overlaps = eventsOverlapInterval(
      [
        planningEvent({
          startAt: "2026-07-13T15:00:00.000Z",
          endAt: "2026-07-13T16:00:00.000Z",
        }),
      ],
      "2026-07-13T15:30:00.000Z",
      "2026-07-13T16:30:00.000Z",
    );

    expect(overlaps).toBe(true);
  });

  it("deducts confirmed focus blocks from unscheduled remaining", () => {
    const remaining = getUnscheduledRemainingMinutes(
      task,
      [
        planningEvent({
          eventType: "focus_block",
          relatedTaskId: "task-1",
          startAt: "2026-07-14T15:00:00.000Z",
          endAt: "2026-07-14T16:00:00.000Z",
        }),
      ],
      new Date("2026-07-13T12:00:00.000Z"),
    );

    expect(remaining).toBe(60);
  });

  it("marks proposal stale when calendar conflicts", () => {
    const proposalHash = computeProposalHash({
      taskId: task.id,
      proposedStartAt: "2026-07-13T15:00:00.000Z",
      proposedEndAt: "2026-07-13T16:00:00.000Z",
      taskRemainingMinutes: 120,
      unscheduledRemainingMinutes: 120,
    });

    const result = validateProposalForAcceptance({
      proposal: {
        id: "proposal-1",
        taskId: task.id,
        proposedStartAt: "2026-07-13T15:00:00.000Z",
        proposedEndAt: "2026-07-13T16:00:00.000Z",
        proposedMinutes: 60,
        proposalHash,
        status: "pending",
        planningRunId: "run-1",
      },
      run: { id: "run-1", status: "generated" },
      task,
      events: [
        planningEvent({
          startAt: "2026-07-13T15:30:00.000Z",
          endAt: "2026-07-13T16:30:00.000Z",
        }),
      ],
      preferences: defaultPlanningPreferences,
      calendarWritable: true,
      userId: "user-1",
      ownerUserId: "user-1",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.shouldMarkStale).toBe(true);
    }
  });

  it("rejects wrong user", () => {
    const result = validateProposalForAcceptance({
      proposal: {
        id: "proposal-1",
        taskId: task.id,
        proposedStartAt: "2026-07-13T15:00:00.000Z",
        proposedEndAt: "2026-07-13T16:00:00.000Z",
        proposedMinutes: 60,
        proposalHash: "hash",
        status: "pending",
        planningRunId: "run-1",
      },
      run: { id: "run-1", status: "generated" },
      task,
      events: [],
      preferences: defaultPlanningPreferences,
      calendarWritable: true,
      userId: "user-1",
      ownerUserId: "user-2",
    });

    expect(result.valid).toBe(false);
  });
});
