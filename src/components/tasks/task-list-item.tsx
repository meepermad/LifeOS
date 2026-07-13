"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteTaskAction,
  reopenTaskAction,
} from "@/lib/actions/tasks";
import { CompletionReviewDialog } from "@/components/tasks/completion-review-dialog";
import { formatAppDate, isOverdue, formatAppTimeRange } from "@/lib/dates/timezone";
import type { TaskRow } from "@/types/domain";
import type { TaskFocusScheduleSummary } from "@/lib/data/planning";
import { DangerButton, SecondaryButton } from "@/components/forms/ui";
export function TaskListItem({
  task,
  atRisk = false,
  focusSummary,
}: {
  task: TaskRow;
  atRisk?: boolean;
  focusSummary?: TaskFocusScheduleSummary;
}) {  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reviewOpen, setReviewOpen] = useState(false);
  const overdue = task.due_at ? isOverdue(task.due_at) : false;
  const missingEstimate =
    task.remaining_minutes == null && task.estimated_minutes == null;

  function handleComplete() {
    setReviewOpen(true);
  }

  function handleReopen() {
    startTransition(async () => {
      await reopenTaskAction(task.id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    startTransition(async () => {
      await deleteTaskAction(task.id);
      router.refresh();
    });
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}/edit`}
            className="font-medium text-foreground hover:text-accent"
          >
            {task.title}
          </Link>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            <span>Priority {task.priority}</span>
            <span>Difficulty {task.difficulty}</span>
            {task.estimated_minutes != null && (
              <span>Est. {task.estimated_minutes}m</span>
            )}
            {task.remaining_minutes != null && (
              <span>Remaining {task.remaining_minutes}m</span>
            )}
            {task.due_at && (
              <span className={overdue ? "text-danger" : undefined}>
                Due {formatAppDate(task.due_at, "MMM d, h:mm a")}
                {overdue ? " (overdue)" : ""}
              </span>
            )}
            {task.source === "canvas" && (
              <span className="text-accent">Canvas</span>
            )}
            {missingEstimate && (
              <span className="text-warning">Needs estimate</span>
            )}
            {atRisk && <span className="text-warning">At risk</span>}
          </div>
          {focusSummary && task.status !== "completed" && (
            <div className="mt-2 space-y-1 text-xs text-muted">
              {focusSummary.remainingMinutes != null && (
                <p>Remaining {focusSummary.remainingMinutes}m</p>
              )}
              {focusSummary.futureScheduledFocusMinutes > 0 && (
                <p>
                  Scheduled focus {focusSummary.futureScheduledFocusMinutes}m
                </p>
              )}
              {focusSummary.remainingMinutes != null && (
                <p>
                  Unscheduled remaining {focusSummary.unscheduledRemainingMinutes}m
                </p>
              )}
              {focusSummary.nextFocusBlock && (
                <p>
                  Next focus block{" "}
                  {formatAppTimeRange(
                    focusSummary.nextFocusBlock.startAt,
                    focusSummary.nextFocusBlock.endAt,
                  )}{" "}
                  ·{" "}
                  <Link href="/today" className="text-accent hover:underline">
                    Today
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted">
          {task.status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {task.status !== "completed" && missingEstimate && task.source === "canvas" && (
          <Link
            href={`/tasks/${task.id}/edit`}
            className="col-span-2 rounded-lg border border-accent px-3 py-2 text-center text-sm font-medium text-accent hover:bg-accent/10"
          >
            Estimate workload
          </Link>
        )}
        {task.status === "completed" ? (
          <SecondaryButton disabled={isPending} onClick={handleReopen}>
            Reopen
          </SecondaryButton>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={handleComplete}
            className="rounded-lg bg-success/15 px-3 py-2 text-sm font-medium text-success hover:bg-success/25 disabled:opacity-50"
          >
            Complete
          </button>
        )}
        <DangerButton disabled={isPending} onClick={handleDelete}>
          Delete
        </DangerButton>
      </div>
      <CompletionReviewDialog
        taskId={task.id}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
    </article>
  );
}
