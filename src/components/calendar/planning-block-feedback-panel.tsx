"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPlanningBlockFeedbackAction } from "@/lib/actions/planning-feedback";
import { SecondaryButton } from "@/components/forms/ui";

export function PlanningBlockFeedbackPanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(feedback: "completed" | "partial" | "skipped") {
    startTransition(async () => {
      await submitPlanningBlockFeedbackAction({
        eventId,
        feedback,
        partialMinutes: feedback === "partial" ? 15 : null,
      });
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium text-muted">Planning block feedback</p>
      <div className="grid grid-cols-3 gap-2">
        <SecondaryButton disabled={isPending} onClick={() => submit("completed")}>
          Done
        </SecondaryButton>
        <SecondaryButton disabled={isPending} onClick={() => submit("partial")}>
          Partial
        </SecondaryButton>
        <SecondaryButton disabled={isPending} onClick={() => submit("skipped")}>
          Skipped
        </SecondaryButton>
      </div>
    </div>
  );
}
