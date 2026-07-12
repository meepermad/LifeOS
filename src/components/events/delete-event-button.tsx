"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteEventAction } from "@/lib/actions/events";
import { DangerButton, SecondaryButton } from "@/components/forms/ui";

export function DeleteEventButton({
  eventId,
  eventTitle,
  redirectHref,
}: {
  eventId: string;
  eventTitle: string;
  redirectHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    startTransition(async () => {
      setError(null);
      const result = await deleteEventAction(eventId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(redirectHref);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <DangerButton onClick={() => setOpen(true)}>Delete event</DangerButton>
    );
  }

  return (
    <div
      className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
      role="dialog"
      aria-labelledby="delete-event-title"
      aria-modal="true"
    >
      <h3 id="delete-event-title" className="text-sm font-medium text-foreground">
        Delete &ldquo;{eventTitle}&rdquo;?
      </h3>
      <p className="text-sm text-muted">This action cannot be undone.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <DangerButton loading={isPending} onClick={handleDelete}>
        Confirm delete
      </DangerButton>
      <SecondaryButton disabled={isPending} onClick={() => setOpen(false)}>
        Cancel
      </SecondaryButton>
    </div>
  );
}
