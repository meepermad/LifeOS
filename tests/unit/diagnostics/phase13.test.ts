import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  requireAllowedUser: vi.fn(),
  createClient: vi.fn(),
  getPlanningPreferences: vi.fn(),
  countBlocksAwaitingFeedback: vi.fn(),
  getOverdueTasksNeedingDecision: vi.fn(),
  countWaitingFollowupsDue: vi.fn(),
}));

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: mocks.requireAllowedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/data/preferences", () => ({
  getPlanningPreferences: mocks.getPlanningPreferences,
}));

vi.mock("@/lib/planning/awaiting-feedback", () => ({
  countBlocksAwaitingFeedback: mocks.countBlocksAwaitingFeedback,
}));

vi.mock("@/lib/reviews/overdue", () => ({
  getOverdueTasksNeedingDecision: mocks.getOverdueTasksNeedingDecision,
}));

vi.mock("@/lib/notifications/workflow-queries", () => ({
  countWaitingFollowupsDue: mocks.countWaitingFollowupsDue,
}));

import { GET } from "@/app/api/diagnostics/phase13/route";

function countChain(count: number) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.then = (
    onFulfilled: (value: { count: number; error: null }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({ count, error: null }).then(onFulfilled, onRejected);
  return builder;
}

describe("GET /api/diagnostics/phase13", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlanningPreferences.mockResolvedValue({
      morning_review_enabled: true,
      evening_review_enabled: false,
      weekly_review_reminder_enabled: true,
      waiting_followup_enabled: false,
      overdue_decision_reminder_enabled: true,
      planning_feedback_reminder_enabled: false,
    });
    mocks.countBlocksAwaitingFeedback.mockResolvedValue(2);
    mocks.getOverdueTasksNeedingDecision.mockResolvedValue([{ id: "t1" }]);
    mocks.countWaitingFollowupsDue.mockResolvedValue(3);
    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => countChain(4)),
    });
  });

  it("requires an allowed user", async () => {
    mocks.requireAllowedUser.mockRejectedValue(new AuthenticationError());
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns aggregate counts only", async () => {
    mocks.requireAllowedUser.mockResolvedValue({ id: "user-1" });
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      activeTemplates: 4,
      templatesNeedingGeneration: 4,
      openReviewSessions: 4,
      completedReviewsToday: 4,
      tasksAwaitingDecisions: 1,
      blocksAwaitingFeedback: 2,
      deferredBecomingActionable: 4,
      waitingFollowupsDue: 3,
      notificationEligibility: {
        morningReview: true,
        eveningReview: false,
        weeklyReview: true,
        waitingFollowup: false,
        overdueDecision: true,
        planningFeedback: false,
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/title|email|token/i);
  });
});
