"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import * as chrono from "chrono-node";
import { captureInboxTaskAction } from "@/lib/actions/inbox";
import { inputClassName, PrimaryButton } from "@/components/forms/ui";

function parseCaptureInput(text: string): {
  title: string;
  dueAt: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { title: "", dueAt: null };
  }

  const results = chrono.parse(trimmed, new Date(), { forwardDate: true });
  if (results.length === 0) {
    return { title: trimmed, dueAt: null };
  }

  const match = results[0]!;
  const dueAt = match.start.date().toISOString();
  const before = trimmed.slice(0, match.index).trim();
  const after = trimmed
    .slice(match.index + match.text.length)
    .trim();
  const title = [before, after].filter(Boolean).join(" ").trim();

  return { title: title || trimmed, dueAt };
}

export function InboxCapture({
  onCaptured,
  compact = false,
}: {
  onCaptured?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = text.trim() ? parseCaptureInput(text) : null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = parseCaptureInput(text);
    if (!parsed.title) {
      setError("Enter a task title");
      return;
    }

    startTransition(async () => {
      const result = await captureInboxTaskAction({
        title: parsed.title,
        dueAt: parsed.dueAt,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setText("");
      onCaptured?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-2" : "space-y-3"}>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Capture a task… try “email advisor Friday”"
        className={inputClassName}
        disabled={isPending}
        autoFocus={!compact}
      />
      {preview?.dueAt && (
        <p className="text-xs text-muted">
          Due detected: {new Date(preview.dueAt).toLocaleString()}
        </p>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <PrimaryButton type="submit" loading={isPending} disabled={!text.trim()}>
        Add to inbox
      </PrimaryButton>
    </form>
  );
}
