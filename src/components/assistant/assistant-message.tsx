import Link from "next/link";
import type { AssistantMessageRow } from "@/types/domain";

type AssistantMessageProps = {
  message: AssistantMessageRow;
  pendingActionId?: string | null;
  onConfirm?: (actionId: string) => void;
  onCancel?: (actionId: string) => void;
  actionLoading?: boolean;
};

export function AssistantMessage({
  message,
  pendingActionId,
  onConfirm,
  onCancel,
  actionLoading,
}: AssistantMessageProps) {
  const isUser = message.role === "user";
  const link = (message.structured_payload as { link?: string } | null)?.link;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={`message-${message.role}`}
    >
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm lg:max-w-[75%] ${
          isUser
            ? "bg-accent text-white"
            : message.message_type === "error"
              ? "border border-danger/30 bg-danger/10 text-foreground"
              : "border border-border bg-surface text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {link && !isUser && (
          <Link
            href={link}
            className="mt-2 inline-block text-xs text-accent hover:text-accent-hover"
          >
            Open in LifeOS →
          </Link>
        )}

        {message.message_type === "action_preview" && pendingActionId && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => onConfirm?.(pendingActionId)}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => onCancel?.(pendingActionId)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
