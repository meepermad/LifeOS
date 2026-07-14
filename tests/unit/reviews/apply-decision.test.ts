import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyReviewDecision } from "@/lib/reviews/apply-decision";

const mockTask = {
  id: "task-1",
  title: "Unfinished work",
  due_at: "2026-07-14T23:59:00.000Z",
  remaining_minutes: 45,
  estimated_minutes: 45,
  minimum_block_minutes: 25,
  sync_managed: false,
  status: "open",
  parent_task_id: null,
};

vi.mock("@/lib/data/tasks", () => ({
  getTaskById: vi.fn(async () => mockTask),
}));

vi.mock("@/lib/data/due-date-revisions", () => ({
  updateTaskDueAt: vi.fn(async (_taskId: string, newDueAt: string | null) => ({
    ...mockTask,
    due_at: newDueAt,
  })),
}));

vi.mock("@/lib/data/inbox", () => ({
  deferTask: vi.fn(async () => mockTask),
  markWaiting: vi.fn(async () => mockTask),
  returnTaskToInbox: vi.fn(async () => mockTask),
  cancelTask: vi.fn(async () => ({ ...mockTask, status: "cancelled" })),
}));

vi.mock("@/lib/data/planning", () => ({
  createShelfPlanningProposal: vi.fn(async () => ({
    proposalId: "proposal-1",
    planningRunId: "run-1",
  })),
}));

vi.mock("@/lib/data/task-split", () => ({
  splitTask: vi.fn(async () => ({
    parentId: "task-1",
    childIds: ["child-1", "child-2"],
  })),
}));

vi.mock("@/lib/data/reviews", () => ({
  recordReviewDecision: vi.fn(async (input: {
    decisionType: string;
    decisionPayload?: Record<string, unknown> | null;
  }) => ({
    id: "decision-1",
    user_id: "user-1",
    session_id: "session-1",
    task_id: "task-1",
    decision_type: input.decisionType,
    decision_payload: input.decisionPayload ?? null,
    created_at: "2026-07-14T12:00:00.000Z",
  })),
}));

import { updateTaskDueAt } from "@/lib/data/due-date-revisions";
import {
  cancelTask,
  deferTask,
  markWaiting,
  returnTaskToInbox,
} from "@/lib/data/inbox";
import { createShelfPlanningProposal } from "@/lib/data/planning";
import { recordReviewDecision } from "@/lib/data/reviews";
import { splitTask } from "@/lib/data/task-split";

describe("applyReviewDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keep_due_date records decision only without mutating due date", async () => {
    const decision = await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "keep_due_date",
    });

    expect(decision.decision_type).toBe("keep_due_date");
    expect(updateTaskDueAt).not.toHaveBeenCalled();
    expect(deferTask).not.toHaveBeenCalled();
    expect(createShelfPlanningProposal).not.toHaveBeenCalled();
    expect(recordReviewDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionType: "keep_due_date",
        decisionPayload: expect.objectContaining({
          effects: expect.objectContaining({ due_at_unchanged: true }),
        }),
      }),
    );
  });

  it("change_deadline and move_due_date call updateTaskDueAt with daily_review", async () => {
    for (const decisionType of ["change_deadline", "move_due_date"] as const) {
      vi.clearAllMocks();
      await applyReviewDecision({
        sessionId: "session-1",
        taskId: "task-1",
        decisionType,
        decisionPayload: { newDueAt: "2026-07-15T23:59:00.000Z" },
      });

      expect(updateTaskDueAt).toHaveBeenCalledWith(
        "task-1",
        "2026-07-15T23:59:00.000Z",
        expect.objectContaining({
          source: "daily_review",
          reviewSessionId: "session-1",
        }),
      );
      expect(recordReviewDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decisionType }),
      );
    }
  });

  it("schedule_tomorrow creates a planning proposal without changing due_at", async () => {
    await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "schedule_tomorrow",
    });

    expect(createShelfPlanningProposal).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "task-1" }),
    );
    expect(updateTaskDueAt).not.toHaveBeenCalled();
    expect(recordReviewDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionType: "schedule_tomorrow",
        decisionPayload: expect.objectContaining({
          effects: expect.objectContaining({
            due_at_unchanged: true,
            proposal_id: "proposal-1",
          }),
        }),
      }),
    );
  });

  it("defer calls deferTask and keeps deadline", async () => {
    await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "defer",
      decisionPayload: { deferredUntilAt: "2026-07-16T12:00:00.000Z" },
    });

    expect(deferTask).toHaveBeenCalledWith(
      "task-1",
      "2026-07-16T12:00:00.000Z",
    );
    expect(updateTaskDueAt).not.toHaveBeenCalled();
  });

  it("return_to_inbox calls returnTaskToInbox", async () => {
    await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "return_to_inbox",
    });

    expect(returnTaskToInbox).toHaveBeenCalledWith("task-1");
  });

  it("mark_waiting calls markWaiting", async () => {
    await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "mark_waiting",
      decisionPayload: {
        waitingReason: "Need reply",
        waitingFollowUpAt: "2026-07-16T23:59:00.000Z",
      },
    });

    expect(markWaiting).toHaveBeenCalledWith("task-1", {
      reason: "Need reply",
      followUpAt: "2026-07-16T23:59:00.000Z",
    });
  });

  it("cancel calls cancelTask", async () => {
    await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "cancel",
    });

    expect(cancelTask).toHaveBeenCalledWith("task-1");
  });

  it("split_task calls splitTask when children are provided", async () => {
    const children = [
      { title: "Part A", remainingMinutes: 20 },
      { title: "Part B", remainingMinutes: 25 },
    ];
    await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "split_task",
      decisionPayload: { children },
    });

    expect(splitTask).toHaveBeenCalledWith({
      taskId: "task-1",
      children,
    });
  });

  it("split_task skips mutator when children are missing", async () => {
    await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "split_task",
    });

    expect(splitTask).not.toHaveBeenCalled();
    expect(recordReviewDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionPayload: expect.objectContaining({
          effects: expect.objectContaining({ split_skipped: true }),
        }),
      }),
    );
  });

  it("uses keep_due_date string consistently (not keep_due)", async () => {
    await applyReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "keep_due_date",
    });

    const call = vi.mocked(recordReviewDecision).mock.calls[0]?.[0];
    expect(call?.decisionType).toBe("keep_due_date");
    expect(call?.decisionType).not.toBe("keep_due");
  });
});
