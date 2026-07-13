"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Draggable } from "@fullcalendar/interaction";
import { formatAppDate } from "@/lib/dates/timezone";
import { formatMinutes } from "@/lib/planning/summaries";
import {
  listShelfTasksAction,
  scheduleTaskFromShelfAction,
} from "@/lib/actions/task-shelf";
import type {
  ShelfEligibleTask,
  ShelfTaskFilter,
} from "@/lib/planning/task-shelf";
import { PrimaryButton, SecondaryButton } from "@/components/forms/ui";

type TaskShelfProps = {
  initialTasks: ShelfEligibleTask[];
  onProposalCreated?: () => void;
};

export function TaskShelf({ initialTasks, onProposalCreated }: TaskShelfProps) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<ShelfTaskFilter>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    const container = listRef.current;
    if (!container || !open) return;

    const draggable = new Draggable(container, {
      itemSelector: ".task-shelf-item",
      eventData: (eventEl) => {
        const taskId = eventEl.getAttribute("data-task-id");
        const minutes = Number(eventEl.getAttribute("data-minutes") ?? "60");
        return {
          title: eventEl.getAttribute("data-title") ?? "Task",
          duration: { minutes },
          extendedProps: { shelfTaskId: taskId },
        };
      },
    });

    return () => draggable.destroy();
  }, [open, tasks]);

  useEffect(() => {
    refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.overdue, filter.dueSoon, filter.weeklyPriority]);

  const refreshTasks = () => {
    startTransition(async () => {
      const result = await listShelfTasksAction(filter);
      if (result.success && result.data) {
        setTasks(result.data);
      }
    });
  };

  const handleSchedule = (task: ShelfEligibleTask) => {
    const defaultStart = new Date();
    defaultStart.setMinutes(defaultStart.getMinutes() + 30 - (defaultStart.getMinutes() % 15));
    const blockMinutes = Math.min(
      60,
      task.unscheduledRemainingMinutes,
      task.task.minimum_block_minutes ?? 25,
    );
    const end = new Date(defaultStart.getTime() + blockMinutes * 60_000);

    startTransition(async () => {
      const result = await scheduleTaskFromShelfAction({
        taskId: task.task.id,
        startAt: defaultStart.toISOString(),
        endAt: end.toISOString(),
      });
      if (result.success) {
        setMessage(`Created proposal for “${task.task.title}”. Accept it from Today or Week.`);
        onProposalCreated?.();
        refreshTasks();
      } else {
        setMessage(result.error);
      }
    });
  };

  return (
    <>
      <SecondaryButton
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="calendar-task-shelf"
      >
        {open ? "Hide tasks" : "Task shelf"}
        {tasks.length > 0 ? ` (${tasks.length})` : ""}
      </SecondaryButton>

      {open && (
        <div
          id="calendar-task-shelf"
          className="mt-3 rounded-xl border border-border bg-surface p-3 lg:fixed lg:right-4 lg:top-24 lg:z-40 lg:mt-0 lg:w-80 lg:shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Unscheduled tasks</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-foreground"
              aria-label="Close task shelf"
            >
              ✕
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <FilterChip
              active={!!filter.overdue}
              onClick={() => {
                setFilter((current) => ({ ...current, overdue: !current.overdue }));
              }}
            >
              Overdue
            </FilterChip>
            <FilterChip
              active={!!filter.dueSoon}
              onClick={() => {
                setFilter((current) => ({ ...current, dueSoon: !current.dueSoon }));
              }}
            >
              Due soon
            </FilterChip>
            <FilterChip
              active={!!filter.weeklyPriority}
              onClick={() => {
                setFilter((current) => ({
                  ...current,
                  weeklyPriority: !current.weeklyPriority,
                }));
              }}
            >
              Priority
            </FilterChip>
          </div>

          <div className="mb-3">
            <SecondaryButton type="button" onClick={refreshTasks} disabled={isPending}>
              Refresh
            </SecondaryButton>
          </div>

          {message && (
            <p className="mb-3 text-xs text-muted" role="status">
              {message}
            </p>
          )}

          <p className="mb-2 text-xs text-muted">
            Drag a task onto the calendar to create a planning proposal.
          </p>

          <div ref={listRef} className="max-h-80 space-y-2 overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">No unscheduled tasks match these filters.</p>
            ) : (
              tasks.map((item) => (
                <TaskShelfItem
                  key={item.task.id}
                  item={item}
                  onSchedule={() => handleSchedule(item)}
                  disabled={isPending}
                />
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-1 ${
        active
          ? "border-accent bg-accent/10 text-foreground"
          : "border-border text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function TaskShelfItem({
  item,
  onSchedule,
  disabled,
}: {
  item: ShelfEligibleTask;
  onSchedule: () => void;
  disabled: boolean;
}) {
  const { task, breakdown } = item;
  const blockMinutes = Math.min(
    120,
    item.unscheduledRemainingMinutes,
    task.minimum_block_minutes ?? 25,
  );

  return (
    <div
      className="task-shelf-item cursor-grab rounded-lg border border-border bg-surface-elevated p-3 active:cursor-grabbing"
      data-task-id={task.id}
      data-title={task.title}
      data-minutes={blockMinutes}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/tasks/${task.id}/edit`}
            className="block truncate text-sm font-medium text-foreground hover:underline"
          >
            {task.title}
          </Link>
          {task.due_at && (
            <p className="text-xs text-muted">
              Due {formatAppDate(task.due_at)}
            </p>
          )}
        </div>
        {item.isWeeklyPriority && (
          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
            Priority
          </span>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted">
        <div>
          <dt className="inline">Remaining </dt>
          <dd className="inline text-foreground">
            {formatMinutes(breakdown.unscheduledRemainingMinutes)}
          </dd>
        </div>
        <div>
          <dt className="inline">Tracked </dt>
          <dd className="inline text-foreground">
            {formatMinutes(breakdown.trackedMinutes)}
          </dd>
        </div>
        <div>
          <dt className="inline">Planned </dt>
          <dd className="inline text-foreground">
            {formatMinutes(breakdown.plannedFutureMinutes)}
          </dd>
        </div>
        <div>
          <dt className="inline">Estimate </dt>
          <dd className="inline text-foreground">
            {breakdown.remainingMinutes != null
              ? formatMinutes(breakdown.remainingMinutes)
              : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-2">
        <PrimaryButton type="button" onClick={onSchedule} disabled={disabled}>
          Schedule
        </PrimaryButton>
      </div>
    </div>
  );
}

export type { ShelfEligibleTask };
