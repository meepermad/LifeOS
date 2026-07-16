"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  discardTimerAction,
  getActiveTimerAction,
  pauseTimerAction,
  resumeTimerAction,
  stopTimerAction,
} from "@/lib/actions/timer";
import type { ActiveTimerState } from "@/lib/data/time-entries";
import { SecondaryButton } from "@/components/forms/ui";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PersistentTimerBar() {
  const [timer, setTimer] = useState<ActiveTimerState | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await getActiveTimerAction();
    if (result.success) {
      setTimer(result.data ?? null);
      setDisplaySeconds(result.data?.elapsedSeconds ?? 0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!timer || timer.isPaused) return;
    const interval = setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  if (!timer) return null;

  const title =
    timer.entry.task_title_snapshot ?? "Active task";

  return (
    <div
      data-persistent-timer
      className="safe-bottom fixed inset-x-0 bottom-16 z-50 border-t border-border bg-surface-elevated/95 px-4 py-2 backdrop-blur-md lg:bottom-0 lg:left-56"
      role="status"
      aria-live="polite"
      aria-label={`Timer running for ${title}`}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 lg:max-w-6xl">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="font-mono text-xs text-accent">{formatElapsed(displaySeconds)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {timer.isPaused ? (
            <SecondaryButton
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await resumeTimerAction();
                  await refresh();
                })
              }
            >
              Resume
            </SecondaryButton>
          ) : (
            <SecondaryButton
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await pauseTimerAction();
                  await refresh();
                })
              }
            >
              Pause
            </SecondaryButton>
          )}
          <SecondaryButton
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await stopTimerAction();
                await refresh();
              })
            }
          >
            Stop
          </SecondaryButton>
          <SecondaryButton
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await discardTimerAction();
                await refresh();
              })
            }
          >
            Discard
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
