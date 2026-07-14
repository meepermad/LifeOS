import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeReviewSession,
  getDailyPriorities,
  recordReviewDecision,
  saveDailyPriorities,
  startReviewSession,
} from "@/lib/data/reviews";

const mockUser = { id: "user-1", email: "test@example.com" };

const mockSession = {
  id: "session-1",
  user_id: "user-1",
  review_type: "morning_daily",
  review_date: "2026-07-12",
  review_week_start: null,
  started_at: "2026-07-12T12:00:00.000Z",
  completed_at: null,
  current_step: 0,
  summary_json: null,
  created_at: "2026-07-12T12:00:00.000Z",
  updated_at: "2026-07-12T12:00:00.000Z",
};

const mockCompletedSession = {
  ...mockSession,
  id: "session-completed",
  completed_at: "2026-07-12T13:00:00.000Z",
};

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(async () => mockUser),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

function chain(result: unknown) {
  const builder: Record<string, unknown> = {};
  const response =
    result && typeof result === "object" && "data" in (result as object)
      ? (result as { data: unknown; error: unknown })
      : { data: result, error: null };

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => response);
  builder.single = vi.fn(async () => response);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.then = (
    onFulfilled: (value: typeof response) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(onFulfilled, onRejected);
  return builder;
}

describe("review sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("startReviewSession returns in-progress session without creating duplicate", async () => {
    mockSupabase.from.mockImplementation(() =>
      chain({ data: mockSession, error: null }),
    );

    const result = await startReviewSession({
      reviewType: "morning_daily",
      reviewDate: "2026-07-12",
    });

    expect(result.created).toBe(false);
    expect(result.session.id).toBe("session-1");
    expect(mockSupabase.from).toHaveBeenCalledWith("review_sessions");
  });

  it("startReviewSession returns completed session when review already done", async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chain({ data: null, error: null });
      }
      return chain({ data: mockCompletedSession, error: null });
    });

    const result = await startReviewSession({
      reviewType: "morning_daily",
      reviewDate: "2026-07-12",
    });

    expect(result.created).toBe(false);
    expect(result.session.completed_at).not.toBeNull();
  });

  it("completeReviewSession is idempotent when already completed", async () => {
    mockSupabase.from.mockImplementation(() =>
      chain({ data: mockCompletedSession, error: null }),
    );

    const result = await completeReviewSession("session-completed");

    expect(result.idempotent).toBe(true);
    expect(result.session.completed_at).toBe("2026-07-12T13:00:00.000Z");
  });

  it("recordReviewDecision does not duplicate same task decision", async () => {
    const existingDecision = {
      id: "decision-1",
      user_id: "user-1",
      session_id: "session-1",
      task_id: "task-1",
      decision_type: "keep_due_date",
      decision_payload: null,
      created_at: "2026-07-12T12:00:00.000Z",
    };

    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chain({ data: mockSession, error: null });
      }
      if (call === 2) {
        return chain({ data: existingDecision, error: null });
      }
      return chain({ data: existingDecision, error: null });
    });

    const decision = await recordReviewDecision({
      sessionId: "session-1",
      taskId: "task-1",
      decisionType: "keep_due_date",
    });

    expect(decision.id).toBe("decision-1");
  });
});

describe("daily priorities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saveDailyPriorities replaces priorities for the date", async () => {
    const priorities = [
      {
        id: "priority-1",
        user_id: "user-1",
        priority_date: "2026-07-12",
        task_id: "task-1",
        priority_rank: 1,
        priority_level: "primary",
        created_at: "2026-07-12T12:00:00.000Z",
      },
    ];

    const tasks = [
      {
        id: "task-1",
        title: "Write report",
        due_at: "2026-07-12T23:59:59.000Z",
        status: "open",
      },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "daily_priorities") {
        return chain({ data: priorities, error: null });
      }
      if (table === "tasks") {
        return chain({ data: tasks, error: null });
      }
      return chain({ data: null, error: null });
    });

    const saved = await saveDailyPriorities({
      priorityDate: "2026-07-12",
      priorities: [{ taskId: "task-1", priorityRank: 1 }],
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]?.task.title).toBe("Write report");
  });

  it("getDailyPriorities returns priorities ordered by rank", async () => {
    const priorities = [
      {
        id: "priority-2",
        user_id: "user-1",
        priority_date: "2026-07-12",
        task_id: "task-2",
        priority_rank: 2,
        priority_level: "primary",
        created_at: "2026-07-12T12:00:00.000Z",
      },
      {
        id: "priority-1",
        user_id: "user-1",
        priority_date: "2026-07-12",
        task_id: "task-1",
        priority_rank: 1,
        priority_level: "primary",
        created_at: "2026-07-12T12:00:00.000Z",
      },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "daily_priorities") {
        return chain({ data: priorities, error: null });
      }
      if (table === "tasks") {
        return chain({
          data: [
            {
              id: "task-1",
              title: "First",
              due_at: null,
              status: "open",
            },
            {
              id: "task-2",
              title: "Second",
              due_at: null,
              status: "open",
            },
          ],
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const loaded = await getDailyPriorities("2026-07-12");
    expect(loaded).toHaveLength(2);
    expect(loaded.map((row) => row.task_id)).toEqual(["task-2", "task-1"]);
  });
});
