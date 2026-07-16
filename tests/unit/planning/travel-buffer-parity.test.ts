import { describe, expect, it } from "vitest";
import {
  eventBlocksInterval,
  findBlockingConflict,
  isBlockingEvent,
} from "@/lib/planning/blocking-overlap";
import { computeProposalHash } from "@/lib/planning/proposal-hash";
import { validateProposalForAcceptance } from "@/lib/planning/proposal-validation";
import type {
  PlanningEvent,
  PlanningPreferences,
  PlanningTask,
  ProposalValidationContext,
} from "@/lib/planning/types";

const prefs = (travelBufferMinutes: number): PlanningPreferences => ({
  minimumBreakMinutes: 0,
  travelBufferMinutes,
  planningBufferPercent: 0,
  preferredFocusBlockMinutes: 60,
  maximumFocusBlockMinutes: 120,
  avoidDifficultWorkAfter: null,
});

function meeting(overrides: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    id: "meeting-1",
    title: "Meeting",
    startAt: "2026-07-16T16:00:00.000Z",
    endAt: "2026-07-16T17:00:00.000Z",
    allDay: false,
    status: "confirmed",
    eventType: "meeting",
    blocksTime: true,
    source: "manual",
    relatedTaskId: null,
    ...overrides,
  };
}

const task: PlanningTask = {
  id: "task-1",
  title: "Focus task",
  status: "open",
  dueAt: null,
  earliestStartAt: null,
  estimatedMinutes: 120,
  remainingMinutes: 120,
  priority: 3,
  difficulty: 3,
  splittable: true,
  minimumBlockMinutes: 30,
  source: "manual",
  relatedEventId: null,
};

function acceptanceContext(
  events: PlanningEvent[],
  travelBufferMinutes: number,
  proposalStart: string,
  proposalEnd: string,
): ProposalValidationContext {
  const proposedMinutes = 60;
  // Hash stores unscheduled *including* this proposal's minutes (generation semantics).
  const proposalHash = computeProposalHash({
    taskId: task.id,
    proposedStartAt: proposalStart,
    proposedEndAt: proposalEnd,
    taskRemainingMinutes: 120,
    unscheduledRemainingMinutes: 120 + proposedMinutes,
  });

  return {
    proposal: {
      id: "prop-1",
      taskId: task.id,
      proposedStartAt: proposalStart,
      proposedEndAt: proposalEnd,
      proposedMinutes,
      proposalHash,
      status: "pending",
      planningRunId: "run-1",
    },
    run: { id: "run-1", status: "generated" },
    task,
    events,
    preferences: prefs(travelBufferMinutes),
    calendarWritable: true,
    userId: "user-1",
    ownerUserId: "user-1",
  };
}

describe("blocking-overlap travel buffer", () => {
  it("event followed by focus with sufficient buffer does not conflict", () => {
    expect(
      eventBlocksInterval(
        meeting(),
        "2026-07-16T17:20:00.000Z",
        "2026-07-16T18:20:00.000Z",
        15,
      ),
    ).toBe(false);
  });

  it("event followed by focus without sufficient buffer conflicts", () => {
    expect(
      eventBlocksInterval(
        meeting(),
        "2026-07-16T17:05:00.000Z",
        "2026-07-16T18:05:00.000Z",
        15,
      ),
    ).toBe(true);
  });

  it("focus followed by event respects buffer before event", () => {
    const event = meeting({
      startAt: "2026-07-16T18:00:00.000Z",
      endAt: "2026-07-16T19:00:00.000Z",
    });
    expect(
      eventBlocksInterval(
        event,
        "2026-07-16T16:50:00.000Z",
        "2026-07-16T17:50:00.000Z",
        15,
      ),
    ).toBe(true);
    expect(
      eventBlocksInterval(
        event,
        "2026-07-16T16:30:00.000Z",
        "2026-07-16T17:30:00.000Z",
        15,
      ),
    ).toBe(false);
  });

  it("blocks_time false does not block", () => {
    const event = meeting({ blocksTime: false });
    expect(
      eventBlocksInterval(
        event,
        "2026-07-16T16:00:00.000Z",
        "2026-07-16T17:00:00.000Z",
        15,
      ),
    ).toBe(false);
    expect(isBlockingEvent(event)).toBe(false);
  });

  it("travel buffer disabled or zero allows adjacent placement", () => {
    expect(
      eventBlocksInterval(
        meeting(),
        "2026-07-16T17:00:00.000Z",
        "2026-07-16T18:00:00.000Z",
        0,
      ),
    ).toBe(false);
  });

  it("cross-midnight interval expands correctly", () => {
    const event = meeting({
      startAt: "2026-07-16T23:30:00.000Z",
      endAt: "2026-07-17T00:30:00.000Z",
    });
    expect(
      eventBlocksInterval(
        event,
        "2026-07-17T00:35:00.000Z",
        "2026-07-17T01:35:00.000Z",
        15,
      ),
    ).toBe(true);
  });

  it("America/Chicago DST spring-forward boundary still detects buffer conflict", () => {
    const event = meeting({
      startAt: "2026-03-08T07:00:00.000Z",
      endAt: "2026-03-08T08:00:00.000Z",
    });
    expect(
      findBlockingConflict(
        [event],
        "2026-03-08T08:05:00.000Z",
        "2026-03-08T09:05:00.000Z",
        15,
      ),
    ).not.toBeNull();
  });
});

describe("acceptance travel-buffer parity", () => {
  it("accepts proposal valid at generation and acceptance with sufficient buffer", () => {
    const result = validateProposalForAcceptance(
      acceptanceContext(
        [meeting()],
        15,
        "2026-07-16T17:20:00.000Z",
        "2026-07-16T18:20:00.000Z",
      ),
    );
    expect(result).toEqual({ valid: true });
  });

  it("rejects buffer-zone conflict on acceptance", () => {
    const result = validateProposalForAcceptance(
      acceptanceContext(
        [meeting()],
        15,
        "2026-07-16T17:05:00.000Z",
        "2026-07-16T18:05:00.000Z",
      ),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/travel buffer|calendar changed/i);
    }
  });

  it("detects new event added after generation in buffer zone", () => {
    const lateMeeting = meeting({
      id: "new-meeting",
      startAt: "2026-07-16T18:00:00.000Z",
      endAt: "2026-07-16T19:00:00.000Z",
    });
    const result = validateProposalForAcceptance(
      acceptanceContext(
        [lateMeeting],
        15,
        "2026-07-16T17:00:00.000Z",
        "2026-07-16T18:00:00.000Z",
      ),
    );
    expect(result.valid).toBe(false);
  });

  it("preference travel buffer increase creates conflict", () => {
    expect(
      eventBlocksInterval(
        meeting(),
        "2026-07-16T17:10:00.000Z",
        "2026-07-16T18:10:00.000Z",
        0,
      ),
    ).toBe(false);
    expect(
      eventBlocksInterval(
        meeting(),
        "2026-07-16T17:10:00.000Z",
        "2026-07-16T18:10:00.000Z",
        20,
      ),
    ).toBe(true);
  });
});
