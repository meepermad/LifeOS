"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeTaskWithReviewAction,
  getCompletionReviewAction,
} from "@/lib/actions/tasks";
import {
  pauseTimerAction,
  stopTimerAction,
} from "@/lib/actions/timer";
import type { CompletionReviewPayload } from "@/lib/analytics/time-authority";
import { isImplausibleDuration } from "@/lib/time/entry-quality";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/components/forms/ui";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function CompletionReviewDialog({
  taskId,
  open,
  onClose,
}: {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<CompletionReviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmImplausible, setConfirmImplausible] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !taskId) {
      setPayload(null);
      return;
    }
    setLoading(true);
    setError(null);
    void getCompletionReviewAction(taskId).then((result) => {
      setLoading(false);
      if (result.success && result.data) {
        setPayload(result.data);
      } else {
        setError(result.success ? "Failed to load review" : result.error);
      }
    });
  }, [open, taskId]);

  if (!open || !taskId) return null;

  const proposedSeconds = payload?.proposedFinalSeconds ?? 0;
  const implausible = isImplausibleDuration(proposedSeconds);
  const estimateMinutes = payload?.currentEstimateMinutes;

  function handleComplete(options: {
    skipSnapshot?: boolean;
    stopTimerFirst?: boolean;
    finalActualSeconds?: number;
  }) {
    if (implausible && !confirmImplausible && !options.skipSnapshot) {
      setConfirmImplausible(true);
      return;
    }

    startTransition(async () => {
      if (!taskId) return;
      if (options.stopTimerFirst && payload?.hasActiveTimer) {
        await stopTimerAction();
      }
      const result = await completeTaskWithReviewAction({
        taskId,
        skipSnapshot: options.skipSnapshot,
        finalActualSeconds: options.finalActualSeconds ?? proposedSeconds,
        stopTimerFirst: options.stopTimerFirst,
      });
      if (result.success) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Complete task review"
    >
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-medium text-foreground">Complete task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading && <p className="text-sm text-muted">Loading timing data…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {payload && (
          <div className="space-y-4 text-sm">
            <p className="font-medium text-foreground">{payload.taskTitle}</p>

            <dl className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex justify-between">
                <dt className="text-muted">Your estimate</dt>
                <dd>{estimateMinutes != null ? `${estimateMinutes}m` : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tracked time</dt>
                <dd>{formatDuration(payload.trackedSeconds)}</dd>
              </div>
              {payload.hasActiveTimer && (
                <div className="flex justify-between text-warning">
                  <dt>Active timer (not counted yet)</dt>
                  <dd>{formatDuration(payload.activeTimerSeconds)}</dd>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <dt className="text-foreground">Proposed actual</dt>
                <dd>{formatDuration(proposedSeconds)}</dd>
              </div>
            </dl>

            {implausible && confirmImplausible && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-warning">
                This duration looks unusual. Confirm to proceed.
              </p>
            )}

            <p className="text-xs text-muted">
              Reviewed completion snapshots feed calibration and insights.
            </p>

            <div className="space-y-2">
              {payload.hasActiveTimer && (
                <>
                  <PrimaryButton
                    loading={isPending}
                    onClick={() =>
                      handleComplete({ stopTimerFirst: true })
                    }
                  >
                    Stop timer and complete
                  </PrimaryButton>
                  <SecondaryButton
                    disabled={isPending}
                    onClick={() => {
                      void pauseTimerAction().then(() => onClose());
                    }}
                  >
                    Pause timer and return
                  </SecondaryButton>
                </>
              )}
              {!payload.hasActiveTimer && proposedSeconds > 0 && (
                <PrimaryButton
                  loading={isPending}
                  onClick={() => handleComplete({})}
                >
                  Complete with tracked time
                </PrimaryButton>
              )}
              <SecondaryButton
                disabled={isPending}
                onClick={() =>
                  handleComplete({ skipSnapshot: true, finalActualSeconds: 0 })
                }
              >
                Complete without actual time
              </SecondaryButton>
              <SecondaryButton disabled={isPending} onClick={onClose}>
                Cancel
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
