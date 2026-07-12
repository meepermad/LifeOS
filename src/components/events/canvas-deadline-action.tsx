"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCanvasTaskEstimateAction } from "@/lib/actions/canvas-deadline";
import { FormField, SecondaryButton } from "@/components/forms/ui";

export function CanvasDeadlineAction({
  eventId,
  taskId,
  eventTitle,
}: {
  eventId: string;
  taskId: string;
  eventTitle: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateCanvasTaskEstimateAction({
        eventId,
        estimatedMinutes: formData.get("estimatedMinutes"),
        priority: formData.get("priority"),
        difficulty: formData.get("difficulty"),
        splittable: formData.get("splittable") === "on",
        minimumBlockMinutes: formData.get("minimumBlockMinutes"),
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setIsOpen(false);
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-2 rounded-lg border border-accent px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10"
      >
        Estimate workload
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted">
        Add your workload estimate for &quot;{eventTitle}&quot;.
      </p>

      <FormField label="Estimated minutes" htmlFor={`estimate-${eventId}`}>
        <input
          id={`estimate-${eventId}`}
          name="estimatedMinutes"
          type="number"
          min={1}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="90"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Priority" htmlFor={`priority-${eventId}`}>
          <input
            id={`priority-${eventId}`}
            name="priority"
            type="number"
            min={1}
            max={5}
            defaultValue={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </FormField>
        <FormField label="Difficulty" htmlFor={`difficulty-${eventId}`}>
          <input
            id={`difficulty-${eventId}`}
            name="difficulty"
            type="number"
            min={1}
            max={5}
            defaultValue={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </FormField>
      </div>

      <FormField label="Minimum block (minutes)" htmlFor={`block-${eventId}`}>
        <input
          id={`block-${eventId}`}
          name="minimumBlockMinutes"
          type="number"
          min={5}
          max={480}
          defaultValue={25}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="splittable" defaultChecked />
        Splittable across days
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Save estimate
        </button>
        <SecondaryButton
          type="button"
          disabled={isPending}
          onClick={() => setIsOpen(false)}
        >
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}
