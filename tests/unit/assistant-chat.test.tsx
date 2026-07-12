import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { AssistantEmptyState } from "@/components/assistant/assistant-empty-state";
import { AssistantMessage } from "@/components/assistant/assistant-message";

vi.mock("@/lib/actions/assistant", () => ({
  sendAssistantMessageAction: vi.fn(async () => ({
    success: true,
    data: { messages: [], pendingAction: null, threadId: "thread-1" },
  })),
  confirmAssistantActionAction: vi.fn(async () => ({
    success: true,
    data: { messages: [], pendingAction: null, threadId: "thread-1" },
  })),
  cancelAssistantActionAction: vi.fn(async () => ({
    success: true,
    data: { messages: [], pendingAction: null, threadId: "thread-1" },
  })),
}));

describe("AssistantEmptyState", () => {
  it("renders empty state text", () => {
    render(<AssistantEmptyState />);
    expect(
      screen.getByText(/Ask LifeOS about your agenda/i),
    ).toBeInTheDocument();
  });
});

describe("AssistantMessage", () => {
  it("renders action preview with confirm and cancel", () => {
    render(
      <AssistantMessage
        message={{
          id: "m1",
          user_id: "u1",
          thread_id: "t1",
          role: "assistant",
          message_type: "action_preview",
          content: "Create this event?",
          structured_payload: {},
          created_at: "2026-07-13T00:00:00.000Z",
        }}
        pendingActionId="action-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("AssistantChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mobile-friendly layout classes", () => {
    const { container } = render(
      <AssistantChat initialMessages={[]} threadId="thread-1" />,
    );
    expect(container.querySelector(".max-w-2xl")).toBeInTheDocument();
  });

  it("renders message history", () => {
    render(
      <AssistantChat
        threadId="thread-1"
        initialMessages={[
          {
            id: "m1",
            user_id: "u1",
            thread_id: "t1",
            role: "user",
            message_type: "text",
            content: "What do I have today?",
            structured_payload: null,
            created_at: "2026-07-13T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("message-user")).toBeInTheDocument();
    expect(screen.getByTestId("message-user")).toHaveTextContent(
      "What do I have today?",
    );
  });
});
