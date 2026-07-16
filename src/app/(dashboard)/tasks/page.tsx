import Link from "next/link";
import { TaskListItem } from "@/components/tasks/task-list-item";
import { TasksFocusClient } from "@/components/tasks/tasks-focus-client";
import { getTaskFocusScheduleSummaries } from "@/lib/data/planning";
import {
  getTaskById,
  listTasks,
  type TaskFilter,
  type TaskSort,
} from "@/lib/data/tasks";
import { getTasksAtRiskIds } from "@/lib/data/workload";
import {
  inferTaskViewFromTask,
  mapTaskViewToFilter,
} from "@/lib/notifications/deep-links";
import type { TaskRow, TaskStatus } from "@/types/domain";

type TasksPageProps = {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    filter?: string;
    view?: string;
    focus?: string;
  }>;
};

const WORKLOAD_FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "missing_estimate", label: "Missing estimates" },
  { value: "overdue", label: "Overdue" },
  { value: "due_this_week", label: "Due this week" },
  { value: "at_risk", label: "At risk" },
  { value: "canvas", label: "Canvas" },
  { value: "inbox", label: "Inbox" },
  { value: "waiting", label: "Waiting" },
  { value: "deferred", label: "Deferred" },
  { value: "recurring", label: "Recurring" },
];

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = await searchParams;
  const sort = (params.sort ?? "due_date") as TaskSort;
  const focusId =
    typeof params.focus === "string" && params.focus.length > 0
      ? params.focus
      : null;

  let focusTask: TaskRow | null = null;
  let focusUnavailable = false;
  if (focusId) {
    try {
      focusTask = await getTaskById(focusId);
    } catch {
      focusUnavailable = true;
      focusTask = null;
    }
  }

  const viewFromFocus = focusTask ? inferTaskViewFromTask(focusTask) : null;
  const requestedView = params.view;
  const filterFromView = mapTaskViewToFilter(
    focusTask ? viewFromFocus ?? requestedView : requestedView,
  );
  const filter =
    (params.filter as TaskFilter | undefined) ?? filterFromView ?? undefined;

  const status = (
    focusTask?.status === "completed"
      ? "completed"
      : (params.status ?? "active")
  ) as TaskStatus | "active" | "all";

  const atRiskIds = filter === "at_risk" ? await getTasksAtRiskIds() : undefined;
  let tasks = await listTasks({ status, sort, filter, atRiskIds });

  if (focusTask && !tasks.some((t) => t.id === focusTask!.id)) {
    tasks = [focusTask, ...tasks];
  }

  const focusSummaries =
    status === "active" || status === "open" || status === "in_progress"
      ? await getTaskFocusScheduleSummaries(tasks)
      : new Map();

  function hrefWithFilter(nextFilter?: TaskFilter) {
    const query = new URLSearchParams();
    query.set("status", status);
    query.set("sort", sort);
    if (nextFilter) query.set("filter", nextFilter);
    return `/tasks?${query.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted">
            Manage open work and deadlines.
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover"
        >
          + Task
        </Link>
      </div>

      {focusUnavailable ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted"
        >
          This item is no longer available.
        </p>
      ) : null}

      <TasksFocusClient focusId={focusUnavailable ? null : focusId} />

      <div className="flex flex-wrap gap-2">
        {[
          { value: "active", label: "Active" },
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In progress" },
          { value: "completed", label: "Completed" },
          { value: "all", label: "All" },
        ].map((item) => (
          <Link
            key={item.value}
            href={`/tasks?status=${item.value}&sort=${sort}${filter ? `&filter=${filter}` : ""}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              status === item.value
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefWithFilter()}
          className={`rounded-full border px-3 py-1 text-xs ${
            !filter ? "border-accent text-accent" : "border-border text-muted"
          }`}
        >
          All workload
        </Link>
        {WORKLOAD_FILTERS.map((item) => (
          <Link
            key={item.value}
            href={hrefWithFilter(item.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === item.value
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/tasks?status=${status}&sort=due_date${filter ? `&filter=${filter}` : ""}`}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            sort === "due_date"
              ? "border-accent text-accent"
              : "border-border text-muted"
          }`}
        >
          Sort by due date
        </Link>
        <Link
          href={`/tasks?status=${status}&sort=priority${filter ? `&filter=${filter}` : ""}`}
          className={`rounded-lg border px-3 py-1.5 text-xs ${
            sort === "priority"
              ? "border-accent text-accent"
              : "border-border text-muted"
          }`}
        >
          Sort by priority
        </Link>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted">
          No tasks match this filter.
        </p>
      ) : (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
          {tasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              atRisk={atRiskIds?.has(task.id)}
              focusSummary={focusSummaries.get(task.id)}
              focused={focusId === task.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
