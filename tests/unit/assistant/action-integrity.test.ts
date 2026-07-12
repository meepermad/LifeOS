import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/errors/app-error";

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import {
  archiveThreadAndStartFresh,
  createAssistantAction,
  expireStaleActions,
  getActionById,
  markActionExecuted,
  rejectAction,
  supersedePendingActions,
} from "@/lib/data/assistant";

const mockUser = {
  id: "user-1",
  email: "user@example.com",
};

const actionRow = {
  id: "action-1",
  user_id: "user-1",
  thread_id: "thread-1",
  source_message_id: "message-1",
  action_type: "create_event",
  status: "proposed",
  proposed_payload: { command: { intent: "create_event" } },
  executed_payload: null,
  idempotency_key: "server-generated-key",
  clarification_state: null,
  expires_at: "2026-07-11T21:00:00.000Z",
  created_at: "2026-07-11T20:00:00.000Z",
  confirmed_at: null,
  executed_at: null,
  rejected_at: null,
};

function createMockClient() {
  const rpc = vi.fn();
  const from = vi.fn();
  return { rpc, from, client: { rpc, from } as never };
}

describe("assistant action integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAllowedUser).mockResolvedValue(mockUser as never);
  });

  it("creates actions via RPC without direct table insert", async () => {
    const { client, rpc, from } = createMockClient();
    rpc.mockResolvedValue({ data: actionRow, error: null });
    vi.mocked(createClient).mockResolvedValue(client);

    const result = await createAssistantAction({
      threadId: "thread-1",
      sourceMessageId: "message-1",
      actionType: "create_event",
      status: "proposed",
      proposedPayload: { command: { intent: "create_event" } },
    });

    expect(rpc).toHaveBeenCalledWith(
      "create_assistant_action",
      expect.objectContaining({
        p_thread_id: "thread-1",
        p_action_type: "create_event",
        p_status: "proposed",
      }),
    );
    expect(from).not.toHaveBeenCalledWith("assistant_actions");
    expect(result.idempotency_key).toBe("server-generated-key");
  });

  it("executes actions via RPC with idempotent retry support", async () => {
    const { client, rpc, from } = createMockClient();
    rpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: true,
        action: {
          ...actionRow,
          status: "executed",
          executed_payload: { message: "done" },
        },
      },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(client);

    const result = await markActionExecuted("action-1", { message: "done" });

    expect(rpc).toHaveBeenCalledWith("execute_assistant_action", {
      p_action_id: "action-1",
      p_executed_payload: { message: "done" },
    });
    expect(from).not.toHaveBeenCalledWith("assistant_actions");
    expect(result.status).toBe("executed");
  });

  it("rejects a single action via RPC", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({
      data: { ...actionRow, status: "rejected" },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(client);

    await rejectAction("action-1");

    expect(rpc).toHaveBeenCalledWith("reject_assistant_action", {
      p_action_id: "action-1",
    });
  });

  it("rejects pending actions in bulk without touching executed records", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: 2, error: null });
    vi.mocked(createClient).mockResolvedValue(client);

    await supersedePendingActions("thread-1");

    expect(rpc).toHaveBeenCalledWith("reject_pending_assistant_actions", {
      p_thread_id: "thread-1",
    });
  });

  it("expires stale actions via RPC", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({ data: 1, error: null });
    vi.mocked(createClient).mockResolvedValue(client);

    await expireStaleActions("thread-1");

    expect(rpc).toHaveBeenCalledWith("expire_stale_assistant_actions", {
      p_thread_id: "thread-1",
    });
  });

  it("preserves executed audit records when clearing chat", async () => {
    const { client, rpc, from } = createMockClient();

    const threadSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "thread-1",
                  user_id: "user-1",
                  title: "LifeOS Assistant",
                  is_active: true,
                  created_at: "2026-07-11T00:00:00.000Z",
                  updated_at: "2026-07-11T00:00:00.000Z",
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    }));

    const threadUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    const threadInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "thread-2",
            user_id: "user-1",
            title: "LifeOS Assistant",
            is_active: true,
            created_at: "2026-07-11T00:00:00.000Z",
            updated_at: "2026-07-11T00:00:00.000Z",
          },
          error: null,
        }),
      })),
    }));

    from.mockImplementation((table: string) => {
      if (table === "assistant_threads") {
        return {
          select: threadSelect,
          update: threadUpdate,
          insert: threadInsert,
        };
      }
      return {};
    });

    rpc.mockResolvedValue({ data: 1, error: null });
    vi.mocked(createClient).mockResolvedValue(client);

    await archiveThreadAndStartFresh();

    expect(rpc).toHaveBeenCalledWith("reject_pending_assistant_actions", {
      p_thread_id: "thread-1",
    });
    expect(from).not.toHaveBeenCalledWith("assistant_actions");
  });

  it("denies access to another user's action on read", async () => {
    const { client, from } = createMockClient();

    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "not found" },
            }),
          })),
        })),
      })),
    });

    vi.mocked(createClient).mockResolvedValue(client);

    await expect(getActionById("action-other")).rejects.toThrow(
      "Assistant action not found",
    );
  });

  it("maps expired execution attempts to a conflict error", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Assistant action has expired" },
    });
    vi.mocked(createClient).mockResolvedValue(client);

    await expect(
      markActionExecuted("action-1", { message: "done" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("maps executed-action rejection attempts to a conflict error", async () => {
    const { client, rpc } = createMockClient();
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Executed assistant actions cannot be rejected" },
    });
    vi.mocked(createClient).mockResolvedValue(client);

    await expect(rejectAction("action-1")).rejects.toBeInstanceOf(ConflictError);
  });
});
