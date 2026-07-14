import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { getTaskById } from "@/lib/data/tasks";
import { createClient } from "@/lib/supabase/server";
import { mapTaskRow } from "@/lib/tasks/map";
import type { Database } from "@/types/database.types";
import type { TaskRow } from "@/types/domain";

export type DueDateRevisionSource =
  | "manual"
  | "daily_review"
  | "weekly_review"
  | "smart_reschedule"
  | "assistant"
  | "recurrence"
  | "canvas_sync";

export type DueDateRevisionRow =
  Database["public"]["Tables"]["task_due_date_revisions"]["Row"];

/**
 * Append-only due-date history. Recurrence initial generation must set
 * due_at on insert directly — do not call updateTaskDueAt for that path.
 */
export async function recordDueDateRevision(input: {
  taskId: string;
  previousDueAt: string | null;
  newDueAt: string | null;
  source: DueDateRevisionSource;
  reason?: string | null;
  reviewSessionId?: string | null;
  assistantActionId?: string | null;
}): Promise<DueDateRevisionRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_due_date_revisions")
    .insert({
      user_id: user.id,
      task_id: input.taskId,
      previous_due_at: input.previousDueAt,
      new_due_at: input.newDueAt,
      reason: input.reason ?? null,
      source: input.source,
      review_session_id: input.reviewSessionId ?? null,
      assistant_action_id: input.assistantActionId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to record due-date revision");
  }

  return data;
}

export async function updateTaskDueAt(
  taskId: string,
  newDueAt: string | null,
  options: {
    source: DueDateRevisionSource;
    reason?: string | null;
    reviewSessionId?: string | null;
    assistantActionId?: string | null;
  },
): Promise<TaskRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const task = await getTaskById(taskId);

  if (task.due_at === newDueAt) {
    return task;
  }

  await recordDueDateRevision({
    taskId,
    previousDueAt: task.due_at,
    newDueAt,
    source: options.source,
    reason: options.reason,
    reviewSessionId: options.reviewSessionId,
    assistantActionId: options.assistantActionId,
  });

  const { data, error } = await supabase
    .from("tasks")
    .update({ due_at: newDueAt })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update task due date");
  }

  return mapTaskRow(data);
}
