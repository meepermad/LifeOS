"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  archiveInboxTaskAction,
  deferInboxTaskAction,
  deleteInboxTaskAction,
  markWaitingAction,
  scheduleInboxTaskAction,
  setInboxDueDateAction,
} from "@/lib/actions/inbox";
import { formatAppDate } from "@/lib/dates/timezone";
import {
  DangerButton,
  EmptyState,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
} from "@/components/forms/ui";
import { InboxCapture } from "@/components/inbox/inbox-capture";
import type { TaskRow } from "@/types/domain";

type InboxViewProps = {
  tasks: TaskRow[];
};

type ActivePanel =
  | null
  | "schedule"
  | "due"
  | "waiting"
  | "defer";

export function InboxView({ tasks }: InboxViewProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "triage">("triage");
  const [index, setIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [dueAt, setDueAt] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [waitingReason, setWaitingReason] = useState("");
  const [waitingFollowUp, setWaitingFollowUp] = useState("");
  const [deferUntil, setDeferUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentTask = useMemo(() => {
    if (mode !== "triage" || tasks.length === 0) {
      return null;
    }
    const safeIndex = Math.min(index, tasks.length - 1);
    return tasks[safeIndex] ?? null;
  }, [index, mode, tasks]);

  function resetPanel() {
    setActivePanel(null);
    setDueAt("");
    setScheduleStart("");
    setScheduleEnd("");
    setWaitingReason("");
    setWaitingFollowUp("");
    setDeferUntil("");
    setError(null);
  }

  function afterAction() {
    resetPanel();
    router.refresh();
  }

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Action failed");
        return;
      }
      afterAction();
    });
  }

  function handleSetDueDate() {
    if (!currentTask || !dueAt) return;
    runAction(() =>
      setInboxDueDateAction(currentTask.id, new Date(dueAt).toISOString()),
    );
  }

  function handleSchedule() {
    if (!currentTask || !scheduleStart || !scheduleEnd) return;
    runAction(() =>
      scheduleInboxTaskAction({
        taskId: currentTask.id,
        startAt: new Date(scheduleStart).toISOString(),
        endAt: new Date(scheduleEnd).toISOString(),
      }),
    );
  }

  function handleMarkWaiting() {
    if (!currentTask || !waitingReason.trim()) return;
    runAction(() =>
      markWaitingAction(currentTask.id, {
        reason: waitingReason.trim(),
        followUpAt: waitingFollowUp
          ? new Date(waitingFollowUp).toISOString()
          : null,
      }),
    );
  }

  function handleDefer() {
    if (!currentTask || !deferUntil) return;
    runAction(() =>
      deferInboxTaskAction(
        currentTask.id,
        new Date(deferUntil).toISOString(),
      ),
    );
  }

  function handleArchive() {
    if (!currentTask) return;
    runAction(() => archiveInboxTaskAction(currentTask.id));
  }

  function handleDelete() {
    if (!currentTask) return;
    if (!confirm(`Delete "${currentTask.title}"?`)) return;
    runAction(() => deleteInboxTaskAction(currentTask.id));
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Quick capture"
        description="Drop tasks here without deciding when to do them yet."
      >
        <InboxCapture />
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("triage");
            setIndex(0);
            resetPanel();
          }}
          className={`rounded-full border px-3 py-1 text-xs ${
            mode === "triage"
              ? "border-accent text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          Triage mode
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("list");
            resetPanel();
          }}
          className={`rounded-full border px-3 py-1 text-xs ${
            mode === "list"
              ? "border-accent text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          List view
        </button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          message="Inbox is clear."
          description="Capture tasks, ideas, and follow-ups here when they come to mind."
          action={{ label: "Go to Today", href: "/today" }}
        />
      ) : mode === "list" ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <article
              key={task.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <h2 className="font-medium text-foreground">{task.title}</h2>
              {task.inbox_at && (
                <p className="mt-1 text-xs text-muted">
                  Captured {formatAppDate(task.inbox_at, "MMM d, h:mm a")}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        currentTask && (
          <SectionCard
            title={`Triage ${index + 1} of ${tasks.length}`}
            description="Process one item at a time."
          >
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground">
                  {currentTask.title}
                </h3>
                {currentTask.inbox_at && (
                  <p className="mt-1 text-sm text-muted">
                    Captured{" "}
                    {formatAppDate(currentTask.inbox_at, "MMM d, h:mm a")}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <SecondaryButton
                  disabled={isPending}
                  onClick={() => {
                    resetPanel();
                    setActivePanel("schedule");
                  }}
                >
                  Schedule
                </SecondaryButton>
                <SecondaryButton
                  disabled={isPending}
                  onClick={() => {
                    resetPanel();
                    setActivePanel("due");
                  }}
                >
                  Add due date
                </SecondaryButton>
                <SecondaryButton
                  disabled={isPending}
                  onClick={() => {
                    resetPanel();
                    setActivePanel("waiting");
                  }}
                >
                  Mark waiting
                </SecondaryButton>
                <SecondaryButton
                  disabled={isPending}
                  onClick={() => {
                    resetPanel();
                    setActivePanel("defer");
                  }}
                >
                  Defer
                </SecondaryButton>
                <SecondaryButton disabled={isPending} onClick={handleArchive}>
                  Archive
                </SecondaryButton>
                <DangerButton disabled={isPending} onClick={handleDelete}>
                  Delete
                </DangerButton>
              </div>

              {activePanel === "schedule" && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="block text-sm text-muted">
                    Focus block start
                    <input
                      type="datetime-local"
                      value={scheduleStart}
                      onChange={(event) => setScheduleStart(event.target.value)}
                      className={`${inputClassName} mt-1`}
                    />
                  </label>
                  <label className="block text-sm text-muted">
                    Focus block end
                    <input
                      type="datetime-local"
                      value={scheduleEnd}
                      onChange={(event) => setScheduleEnd(event.target.value)}
                      className={`${inputClassName} mt-1`}
                    />
                  </label>
                  <PrimaryButton
                    loading={isPending}
                    disabled={!scheduleStart || !scheduleEnd}
                    onClick={handleSchedule}
                  >
                    Save focus block
                  </PrimaryButton>
                </div>
              )}

              {activePanel === "due" && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="block text-sm text-muted">
                    Due date
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={(event) => setDueAt(event.target.value)}
                      className={`${inputClassName} mt-1`}
                    />
                  </label>
                  <PrimaryButton
                    loading={isPending}
                    disabled={!dueAt}
                    onClick={handleSetDueDate}
                  >
                    Set due date
                  </PrimaryButton>
                </div>
              )}

              {activePanel === "waiting" && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="block text-sm text-muted">
                    Waiting on
                    <input
                      type="text"
                      value={waitingReason}
                      onChange={(event) => setWaitingReason(event.target.value)}
                      placeholder="e.g. reply from advisor"
                      className={`${inputClassName} mt-1`}
                    />
                  </label>
                  <label className="block text-sm text-muted">
                    Follow up (optional)
                    <input
                      type="datetime-local"
                      value={waitingFollowUp}
                      onChange={(event) =>
                        setWaitingFollowUp(event.target.value)
                      }
                      className={`${inputClassName} mt-1`}
                    />
                  </label>
                  <PrimaryButton
                    loading={isPending}
                    disabled={!waitingReason.trim()}
                    onClick={handleMarkWaiting}
                  >
                    Mark waiting
                  </PrimaryButton>
                </div>
              )}

              {activePanel === "defer" && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="block text-sm text-muted">
                    Defer until
                    <input
                      type="datetime-local"
                      value={deferUntil}
                      onChange={(event) => setDeferUntil(event.target.value)}
                      className={`${inputClassName} mt-1`}
                    />
                  </label>
                  <PrimaryButton
                    loading={isPending}
                    disabled={!deferUntil}
                    onClick={handleDefer}
                  >
                    Defer task
                  </PrimaryButton>
                </div>
              )}

              <div className="flex gap-2">
                <SecondaryButton
                  disabled={isPending || index === 0}
                  onClick={() => {
                    setIndex((value) => Math.max(0, value - 1));
                    resetPanel();
                  }}
                >
                  Previous
                </SecondaryButton>
                <SecondaryButton
                  disabled={isPending || index >= tasks.length - 1}
                  onClick={() => {
                    setIndex((value) => Math.min(tasks.length - 1, value + 1));
                    resetPanel();
                  }}
                >
                  Skip
                </SecondaryButton>
              </div>
            </div>
          </SectionCard>
        )
      )}
    </div>
  );
}
