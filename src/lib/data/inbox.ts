import { ConflictError, DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { getLifeOSPlanningCalendar } from "@/lib/data/calendars";
import { getTaskById } from "@/lib/data/tasks";
import { defaultBlocksTimeForEventType } from "@/lib/planning/mappers";
import { canExitInbox, shouldAssignInboxAt } from "@/lib/tasks/triage";
import { createClient } from "@/lib/supabase/server";
import { mapTaskRow, mapTaskRows } from "@/lib/tasks/map";
import type { TaskRow } from "@/types/domain";
import type { Database } from "@/types/database.types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

async function taskHasFutureFocusBlock(taskId: string): Promise<boolean> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("user_id", user.id)
    .eq("related_task_id", taskId)
    .eq("event_type", "focus_block")
    .eq("status", "confirmed")
    .gte("start_at", now)
    .limit(1);

  if (error) {
    throw new DatabaseError("Failed to check focus blocks");
  }

  return (data?.length ?? 0) > 0;
}

async function applyTriageExit(
  task: TaskRow,
  updates: TaskUpdate,
): Promise<TaskUpdate> {
  const hasFutureFocusBlock = await taskHasFutureFocusBlock(task.id);
  const merged = { ...task, ...updates } as TaskRow;

  if (canExitInbox(merged, { hasFutureFocusBlock })) {
    return { ...updates, inbox_at: null };
  }

  return updates;
}

export async function createInboxTask(input: {
  title: string;
  description?: string | null;
  dueAt?: string | null;
}): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const dueAt = input.dueAt ?? null;
  const inboxAt = dueAt ? null : now;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      description: input.description ?? null,
      source: "manual",
      status: "open",
      workflow_state: "actionable",
      due_at: dueAt,
      inbox_at: inboxAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to capture inbox task");
  }

  return mapTaskRow(data);
}

export async function listInboxTasks(): Promise<TaskRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .not("inbox_at", "is", null)
    .in("status", ["open", "in_progress", "deferred"])
    .order("inbox_at", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load inbox tasks");
  }

  return mapTaskRows(data ?? []);
}

export async function triageTask(
  taskId: string,
  updates: TaskUpdate,
): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const task = await getTaskById(taskId);
  const payload = await applyTriageExit(task, updates);

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to triage task");
  }

  return mapTaskRow(data);
}

export async function setInboxTaskDueDate(
  taskId: string,
  dueAt: string,
): Promise<TaskRow> {
  return triageTask(taskId, { due_at: dueAt });
}

export async function scheduleInboxFocusBlock(input: {
  taskId: string;
  startAt: string;
  endAt: string;
}): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const task = await getTaskById(input.taskId);
  const calendar = await getLifeOSPlanningCalendar();

  if (!calendar?.is_writable) {
    throw new ConflictError("LifeOS Planning calendar is not available");
  }

  const { error: eventError } = await supabase.from("events").insert({
    user_id: user.id,
    calendar_id: calendar.id,
    title: task.title,
    description: task.description,
    start_at: input.startAt,
    end_at: input.endAt,
    all_day: false,
    status: "confirmed",
    source: "lifeos",
    event_type: "focus_block",
    related_task_id: task.id,
    is_read_only: false,
    blocks_time: defaultBlocksTimeForEventType("focus_block"),
  });

  if (eventError) {
    throw new DatabaseError("Failed to schedule focus block");
  }

  return triageTask(task.id, {});
}

export async function markWaiting(
  taskId: string,
  input: {
    reason: string;
    followUpAt?: string | null;
  },
): Promise<TaskRow> {
  return triageTask(taskId, {
    workflow_state: "waiting",
    waiting_reason: input.reason.trim(),
    waiting_follow_up_at: input.followUpAt ?? null,
  });
}

export async function deferTask(
  taskId: string,
  untilAt: string,
): Promise<TaskRow> {
  return triageTask(taskId, {
    deferred_until_at: untilAt,
    status: "deferred",
  });
}

export async function archiveInboxItem(taskId: string): Promise<TaskRow> {
  return triageTask(taskId, { workflow_state: "someday" });
}

export function assertInboxEligibleForCapture(
  task: Pick<TaskRow, "sync_managed">,
): void {
  if (!shouldAssignInboxAt(task)) {
    throw new ConflictError("Sync-managed tasks cannot enter the inbox");
  }
}
