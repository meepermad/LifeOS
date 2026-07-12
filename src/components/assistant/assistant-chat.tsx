"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  cancelAssistantActionAction,
  confirmAssistantActionAction,
  sendAssistantMessageAction,
} from "@/lib/actions/assistant";
import type { AssistantActionPreview } from "@/lib/data/assistant";
import type { AssistantMessageRow } from "@/types/domain";
import { AssistantComposer } from "@/components/assistant/assistant-composer";
import { AssistantEmptyState } from "@/components/assistant/assistant-empty-state";
import { AssistantMessage } from "@/components/assistant/assistant-message";
import { SuggestedCommands } from "@/components/assistant/suggested-commands";

type AssistantChatProps = {
  initialMessages: AssistantMessageRow[];
  pendingAction?: AssistantActionPreview | null;
  threadId: string;
};

export function AssistantChat({
  initialMessages,
  pendingAction: initialPendingAction,
}: AssistantChatProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [pendingAction, setPendingAction] = useState(initialPendingAction);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, pendingAction]);

  function handleSend(text: string) {
    setError(null);
    startTransition(async () => {
      const result = await sendAssistantMessageAction(text);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessages(result.data?.messages ?? []);
      setPendingAction(result.data?.pendingAction ?? null);
      const form = document.getElementById(
        "assistant-message",
      ) as HTMLInputElement | null;
      if (form?.form) {
        form.form.reset();
      }
    });
  }

  function handleConfirm(actionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await confirmAssistantActionAction(actionId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessages(result.data?.messages ?? []);
      setPendingAction(result.data?.pendingAction ?? null);
    });
  }

  function handleCancel(actionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelAssistantActionAction(actionId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessages(result.data?.messages ?? []);
      setPendingAction(null);
    });
  }

  const showEmpty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col lg:h-[calc(100dvh-6rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
        <p className="mt-1 text-sm text-muted">
          Deterministic planning commands with confirmation before writes.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {showEmpty && <AssistantEmptyState />}

        {messages.map((message) => {
          const isPendingPreview =
            message.message_type === "action_preview" &&
            pendingAction?.id &&
            message.content === pendingAction.content;

          return (
            <AssistantMessage
              key={message.id}
              message={message}
              pendingActionId={
                isPendingPreview ? pendingAction?.id : undefined
              }
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              actionLoading={isPending}
            />
          );
        })}

        {isPending && (
          <p className="text-sm text-muted" role="status">
            Thinking…
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mb-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showEmpty && (
        <div className="mb-3">
          <SuggestedCommands onSelect={handleSend} disabled={isPending} />
        </div>
      )}

      <AssistantComposer onSend={handleSend} loading={isPending} />
    </div>
  );
}
