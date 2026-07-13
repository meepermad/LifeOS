import { ConflictError, DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { sumTrackedSecondsForTask } from "@/lib/data/time-entries";
import {
  applyTaskCompletion,
  parseTaskForm,
  type ParsedTaskInput,
  type TaskFormInput,
} from "@/lib/validation/tasks";
import { mapTaskRow, mapTaskRows } from "@/lib/tasks/map";
import type { TaskRow, TaskStatus } from "@/types/domain";

export type TaskSort = "due_date" | "priority";

export type TaskFilter =
  | "missing_estimate"
  | "overdue"
  | "due_this_week"
  | "at_risk"
  | "canvas"
  | "inbox"
  | "waiting"
  | "deferred"
  | "recurring";

export async function listTasks(options?: {
  status?: TaskStatus | "active" | "all";
  sort?: TaskSort;
  filter?: TaskFilter;
  atRiskIds?: Set<string>;
}): Promise<TaskRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  let query = supabase.from("tasks").select("*").eq("user_id", user.id);

  const status = options?.status ?? "active";
  if (status === "active") {
    query = query.in("status", ["open", "in_progress", "deferred"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  const sort = options?.sort ?? "due_date";
  if (sort === "priority") {
    query = query.order("priority", { ascending: true }).order("due_at", {
      ascending: true,
      nullsFirst: false,
    });
  } else {
    query = query
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    throw new DatabaseError("Failed to load tasks");
  }

  let tasks = data ?? [];

  if (options?.filter) {
    const { isDueToday, isOverdue, getWeekBounds, getAppLocalDateKey } =
      await import("@/lib/dates/timezone");
    const { isDeferredHidden, isInboxTask } = await import("@/lib/tasks/triage");
    const now = new Date();
    const { start, end } = getWeekBounds(now, 0);
    const weekStartKey = getAppLocalDateKey(start);
    const weekEndKey = getAppLocalDateKey(end);

    tasks = tasks.filter((task) => {
      switch (options.filter) {
        case "missing_estimate":
          return task.remaining_minutes == null && task.estimated_minutes == null;
        case "overdue":
          return task.due_at ? isOverdue(task.due_at, now) : false;
        case "due_this_week": {
          if (!task.due_at) return false;
          const dueKey = getAppLocalDateKey(task.due_at);
          return dueKey >= weekStartKey && dueKey <= weekEndKey;
        }
        case "at_risk":
          return options.atRiskIds?.has(task.id) ?? false;
        case "canvas":
          return task.source === "canvas";
        case "inbox":
          return isInboxTask(task);
        case "waiting":
          return task.workflow_state === "waiting";
        case "deferred":
          return isDeferredHidden(task, now);
        case "recurring":
          return task.recurrence_template_id != null;
        default:
          return true;
      }
    });
  }

  return mapTaskRows(tasks);
}

export async function getTaskById(taskId: string): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new DatabaseError("Task not found");
  }

  return mapTaskRow(data);
}

export async function createTask(
  input: ParsedTaskInput,
  options?: { source?: "manual" | "assistant" },
): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description,
      source: options?.source ?? "manual",
      due_at: input.dueAt,
      earliest_start_at: input.earliestStartAt,
      estimated_minutes: input.estimatedMinutes,
      remaining_minutes: input.remainingMinutes,
      priority: input.priority,
      difficulty: input.difficulty,
      status: input.status,
      splittable: input.splittable,
      minimum_block_minutes: input.minimumBlockMinutes,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create task");
  }

  return mapTaskRow(data);
}

export async function updateTask(
  taskId: string,
  input: ParsedTaskInput,
): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      description: input.description,
      due_at: input.dueAt,
      earliest_start_at: input.earliestStartAt,
      estimated_minutes: input.estimatedMinutes,
      remaining_minutes: input.remainingMinutes,
      priority: input.priority,
      difficulty: input.difficulty,
      status: input.status,
      splittable: input.splittable,
      minimum_block_minutes: input.minimumBlockMinutes,
      completed_at:
        input.status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update task");
  }

  return mapTaskRow(data);
}

export async function setTaskCompletion(
  taskId: string,
  complete: boolean,
  options?: {
    adjustmentSeconds?: number;
    skipSnapshot?: boolean;
    finalActualSeconds?: number;
    updatedEstimateMinutes?: number | null;
    correctionOfSnapshotId?: string;
  },
): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const existing = await getTaskById(taskId);
  const updates = applyTaskCompletion(existing, complete);
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (!complete) {
    await supabase
      .from("task_completion_snapshots")
      .update({ is_current: false, superseded_at: now })
      .eq("user_id", user.id)
      .eq("task_id", taskId)
      .eq("is_current", true);

    const { data, error } = await supabase
      .from("tasks")
      .update({
        ...updates,
        actual_minutes: null,
      })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to reopen task");
    }
    return mapTaskRow(data);
  }

  let actualMinutes: number | undefined;
  if (!options?.skipSnapshot) {
    const trackedSeconds = await sumTrackedSecondsForTask(taskId);
    const adjustmentSeconds = options?.adjustmentSeconds ?? 0;
    const finalActualSeconds =
      options?.finalActualSeconds ??
      trackedSeconds + adjustmentSeconds;

    await supabase
      .from("task_completion_snapshots")
      .update({ is_current: false, superseded_at: now })
      .eq("user_id", user.id)
      .eq("task_id", taskId)
      .eq("is_current", true);

    const { data: latest } = await supabase
      .from("task_completion_snapshots")
      .select("completion_sequence")
      .eq("user_id", user.id)
      .eq("task_id", taskId)
      .order("completion_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = (latest?.completion_sequence ?? 0) + 1;
    const estimateMinutes =
      options?.updatedEstimateMinutes ?? existing.estimated_minutes;

    if (
      options?.updatedEstimateMinutes != null &&
      options.updatedEstimateMinutes !== existing.estimated_minutes
    ) {
      await supabase.from("task_estimate_revisions").insert({
        user_id: user.id,
        task_id: taskId,
        previous_minutes: existing.estimated_minutes,
        new_minutes: options.updatedEstimateMinutes,
        revision_source: "completion_review",
      });
    }

    const { error: snapshotError } = await supabase
      .from("task_completion_snapshots")
      .insert({
        user_id: user.id,
        task_id: taskId,
        completed_at: now,
        original_estimate_minutes: existing.estimated_minutes,
        current_estimate_minutes: estimateMinutes,
        tracked_seconds: trackedSeconds,
        adjustment_seconds: adjustmentSeconds,
        final_actual_seconds: finalActualSeconds,
        estimate_revision_count:
          options?.updatedEstimateMinutes != null &&
          options.updatedEstimateMinutes !== existing.estimated_minutes
            ? 1
            : 0,
        completion_sequence: nextSequence,
        is_current: true,
        correction_of_snapshot_id: options?.correctionOfSnapshotId ?? null,
      });

    if (snapshotError) {
      throw new DatabaseError("Failed to save completion snapshot");
    }

    if (finalActualSeconds > 0) {
      actualMinutes = Math.round(finalActualSeconds / 60);
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...updates,
      ...(options?.updatedEstimateMinutes != null
        ? { estimated_minutes: options.updatedEstimateMinutes }
        : {}),
      ...(actualMinutes != null ? { actual_minutes: actualMinutes } : {}),
      ...(options?.skipSnapshot ? { actual_minutes: null } : {}),
    })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update task status");
  }

  return mapTaskRow(data);
}

export async function correctCompletionSnapshot(input: {
  taskId: string;
  finalActualSeconds: number;
  adjustmentSeconds?: number;
  updatedEstimateMinutes?: number | null;
}): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: current, error } = await supabase
    .from("task_completion_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("is_current", true)
    .maybeSingle();

  if (error || !current) {
    throw new DatabaseError("No current completion snapshot to correct");
  }

  const trackedSeconds = await sumTrackedSecondsForTask(input.taskId);
  const now = new Date().toISOString();

  await supabase
    .from("task_completion_snapshots")
    .update({ is_current: false, superseded_at: now })
    .eq("id", current.id)
    .eq("user_id", user.id);

  const nextSequence = current.completion_sequence + 1;
  const adjustmentSeconds = input.adjustmentSeconds ?? 0;

  await supabase.from("task_completion_snapshots").insert({
    user_id: user.id,
    task_id: input.taskId,
    completed_at: current.completed_at,
    original_estimate_minutes: current.original_estimate_minutes,
    current_estimate_minutes:
      input.updatedEstimateMinutes ?? current.current_estimate_minutes,
    tracked_seconds: trackedSeconds,
    adjustment_seconds: adjustmentSeconds,
    final_actual_seconds: input.finalActualSeconds,
    estimate_revision_count: current.estimate_revision_count,
    completion_sequence: nextSequence,
    is_current: true,
    correction_of_snapshot_id: current.id,
  });

  const actualMinutes =
    input.finalActualSeconds > 0
      ? Math.round(input.finalActualSeconds / 60)
      : null;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .update({
      actual_minutes: actualMinutes,
      ...(input.updatedEstimateMinutes != null
        ? { estimated_minutes: input.updatedEstimateMinutes }
        : {}),
    })
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (taskError || !task) {
    throw new DatabaseError("Failed to update task after correction");
  }

  return mapTaskRow(task);
}

export async function deleteTask(taskId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete task");
  }
}

export function parseAndCreateTask(input: TaskFormInput): Promise<TaskRow> {
  return createTask(parseTaskForm(input));
}

export function parseAndUpdateTask(
  taskId: string,
  input: TaskFormInput,
): Promise<TaskRow> {
  return updateTask(taskId, parseTaskForm(input));
}

export async function createTaskFromCanvasDeadline(input: {
  eventId: string;
  estimatedMinutes: number;
  priority?: number;
  difficulty?: number;
  earliestStartAt?: string | null;
  splittable?: boolean;
  minimumBlockMinutes?: number;
}): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", input.eventId)
    .eq("user_id", user.id)
    .single();

  if (eventError || !event) {
    throw new DatabaseError("Event not found");
  }

  if (event.source !== "canvas" || event.event_type !== "deadline") {
    throw new ConflictError("Only Canvas deadline events can be converted");
  }

  const linkedTask = await findLinkedCanvasTaskForEvent(user.id, event.id, event.external_event_id);

  if (!linkedTask) {
    throw new ConflictError(
      "No linked task found for this deadline. Sync Canvas first to create the assignment task.",
    );
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      estimated_minutes: input.estimatedMinutes,
      remaining_minutes: input.estimatedMinutes,
      priority: input.priority ?? linkedTask.priority,
      difficulty: input.difficulty ?? linkedTask.difficulty,
      earliest_start_at: input.earliestStartAt ?? linkedTask.earliest_start_at,
      splittable: input.splittable ?? linkedTask.splittable,
      minimum_block_minutes:
        input.minimumBlockMinutes ?? linkedTask.minimum_block_minutes,
    })
    .eq("id", linkedTask.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update Canvas task estimate");
  }

  return mapTaskRow(data);
}

export async function updateCanvasTaskEstimate(input: {
  eventId: string;
  estimatedMinutes: number;
  priority?: number;
  difficulty?: number;
  earliestStartAt?: string | null;
  splittable?: boolean;
  minimumBlockMinutes?: number;
}): Promise<TaskRow> {
  return createTaskFromCanvasDeadline(input);
}

async function findLinkedCanvasTaskForEvent(
  userId: string,
  eventId: string,
  externalEventId: string | null,
): Promise<TaskRow | null> {
  const supabase = await createClient();

  const { data: byEvent, error: byEventError } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("related_event_id", eventId)
    .maybeSingle();

  if (byEventError) {
    throw new DatabaseError("Failed to load linked task");
  }

  if (byEvent) {
    return mapTaskRow(byEvent);
  }

  if (!externalEventId) {
    return null;
  }

  const { data: byExternal, error: byExternalError } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("source", "canvas")
    .eq("external_task_id", externalEventId)
    .maybeSingle();

  if (byExternalError) {
    throw new DatabaseError("Failed to load linked task");
  }

  return byExternal ? mapTaskRow(byExternal) : null;
}

export type CanvasTaskForSync = TaskRow;

export async function listCanvasTasksForSync(
  externalTaskIds: string[],
): Promise<CanvasTaskForSync[]> {
  if (externalTaskIds.length === 0) {
    return [];
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("source", "canvas")
    .in("external_task_id", externalTaskIds);

  if (error) {
    throw new DatabaseError("Failed to load Canvas tasks for sync");
  }

  return mapTaskRows(data ?? []);
}

export async function listCanvasTasksByRelatedEventIds(
  eventIds: string[],
): Promise<CanvasTaskForSync[]> {
  if (eventIds.length === 0) {
    return [];
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("source", "canvas")
    .in("related_event_id", eventIds);

  if (error) {
    throw new DatabaseError("Failed to load Canvas tasks by related event");
  }

  return mapTaskRows(data ?? []);
}

export type CanvasTaskSyncInsert = {
  user_id: string;
  title: string;
  description: string | null;
  source: "canvas";
  external_task_id: string;
  due_at: string;
  estimated_minutes: null;
  remaining_minutes: null;
  priority: number;
  difficulty: number;
  status: "open" | "cancelled";
  splittable: boolean;
  minimum_block_minutes: number;
  related_event_id: string;
  sync_managed: boolean;
  cancelled_by_sync: boolean;
  source_content_hash: string;
};

export type CanvasTaskSyncUpdate = {
  id: string;
  title: string;
  description: string | null;
  external_task_id: string;
  due_at: string;
  related_event_id: string;
  source_content_hash: string;
  sync_managed: boolean;
  status?: TaskStatus;
  cancelled_by_sync?: boolean;
};

export async function batchInsertCanvasTasks(
  rows: CanvasTaskSyncInsert[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").insert(
    rows.map((row) => ({
      ...row,
      user_id: user.id,
    })),
  );

  if (error) {
    throw new DatabaseError("Failed to batch insert Canvas tasks");
  }
}

export async function batchUpdateCanvasTasks(
  rows: CanvasTaskSyncUpdate[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  await Promise.all(
    rows.map(async (row) => {
      const { id, ...payload } = row;
      const { error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw new DatabaseError("Failed to batch update Canvas tasks");
      }
    }),
  );
}

export async function cancelSyncManagedTasksForEvents(
  eventIds: string[],
): Promise<number> {
  if (eventIds.length === 0) {
    return 0;
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("source", "canvas")
    .eq("sync_managed", true)
    .in("related_event_id", eventIds)
    .in("status", ["open", "in_progress", "deferred"]);

  if (error) {
    throw new DatabaseError("Failed to load tasks for cancellation");
  }

  const toCancel = (tasks ?? []).filter((task) => task.status !== "completed");
  if (toCancel.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: "cancelled", cancelled_by_sync: true })
    .in(
      "id",
      toCancel.map((task) => task.id),
    )
    .eq("user_id", user.id);

  if (updateError) {
    throw new DatabaseError("Failed to cancel sync-managed Canvas tasks");
  }

  return toCancel.length;
}

export async function listTodayAndOverdueTasks(): Promise<{
  dueToday: TaskRow[];
  overdue: TaskRow[];
}> {
  const tasks = await listTasks({ status: "active", sort: "due_date" });
  const { isDueToday, isOverdue } = await import("@/lib/dates/timezone");
  const now = new Date();

  const dueToday = tasks.filter((task) => isDueToday(task.due_at, now));
  const overdue = tasks.filter(
    (task) => task.due_at && isOverdue(task.due_at, now) && !isDueToday(task.due_at, now),
  );

  return { dueToday, overdue };
}
