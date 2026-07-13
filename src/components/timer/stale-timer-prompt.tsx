"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  discardTimerAction,
  stopTimerAction,
} from "@/lib/actions/timer";
import type { ActiveTimerState } from "@/lib/data/time-entries";
import { formatStalePrompt } from "@/lib/time/stale-timer";
import { DangerButton, PrimaryButton, SecondaryButton } from "@/components/forms/ui";

export function StaleTimerPrompt({
  active,
  thresholdHours,
}: {
  active: ActiveTimerState;
  thresholdHours: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [endTime, setEndTime] = useState("");

  const message = formatStalePrompt(active, thresholdHours);

  function handleStillWorking() {
    router.replace("/today");
  }

  function handleStopNow() {
    startTransition(async () => {
      await stopTimerAction();
      router.refresh();
    });
  }

  function handleDiscard() {
    startTransition(async () => {
      await discardTimerAction();
      router.refresh();
    });
  }

  function handleBackdatedStop() {
    if (!endTime) return;
    const endedAt = new Date(endTime).toISOString();
    startTransition(async () => {
      await stopTimerAction(endedAt);
      router.refresh();
    });
  }

  return (
    <div
      className="mx-4 mb-2 rounded-xl border border-warning/40 bg-warning/10 p-4"
      role="alert"
    >
      <p className="text-sm text-foreground">{message}</p>
      <div className="mt-3 space-y-2">
        <PrimaryButton loading={isPending} onClick={handleStillWorking}>
          Still working
        </PrimaryButton>
        <SecondaryButton disabled={isPending} onClick={handleStopNow}>
          Stop now
        </SecondaryButton>
        <SecondaryButton
          disabled={isPending}
          onClick={() => setShowEndPicker((v) => !v)}
        >
          Choose end time
        </SecondaryButton>
        {showEndPicker && (
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={isPending || !endTime}
              onClick={handleBackdatedStop}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Stop
            </button>
          </div>
        )}
        <DangerButton disabled={isPending} onClick={handleDiscard}>
          Discard timer
        </DangerButton>
      </div>
    </div>
  );
}
