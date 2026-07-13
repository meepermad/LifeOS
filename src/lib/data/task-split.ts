import { ConflictError, DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getTaskById } from "@/lib/data/tasks";
import { mapTaskRows } from "@/lib/tasks/map";
import type { TaskRow } from "@/types/domain";

export type SplitChildInput = {
  title: string;
  remainingMinutes: number;
};

export async function splitTask(input: {
  taskId: string;
  children: SplitChildInput[];
}): Promise<{ parentId: string; childIds: string[] }> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const parent = await getTaskById(input.taskId);

  if (parent.sync_managed) {
    throw new ConflictError("Canvas-managed tasks cannot be split");
  }

  if (parent.parent_task_id) {
    throw new ConflictError("Subtasks cannot be split further");
  }

  if (input.children.length < 2) {
    throw new ConflictError("Split requires at least two subtasks");
  }

  for (const child of input.children) {
    if (!child.title.trim()) {
      throw new ConflictError("Each subtask needs a title");
    }
    if (child.remainingMinutes <= 0) {
      throw new ConflictError("Each subtask needs positive remaining minutes");
    }
  }

  const { data: existingChildren, error: existingError } = await supabase
    .from("tasks")
    .select("id")
    .eq("user_id", user.id)
    .eq("parent_task_id", parent.id);

  if (existingError) {
    throw new DatabaseError("Failed to check existing subtasks");
  }

  if ((existingChildren ?? []).length > 0) {
    throw new ConflictError("This task already has subtasks");
  }

  const parentWorkload =
    parent.remaining_minutes ?? parent.estimated_minutes ?? 0;
  const childTotal = input.children.reduce(
    (sum, child) => sum + child.remainingMinutes,
    0,
  );

  if (parentWorkload > 0 && childTotal > parentWorkload) {
    throw new ConflictError(
      "Subtask minutes cannot exceed the parent remaining estimate",
    );
  }

  const childIds: string[] = [];

  for (const child of input.children) {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: child.title.trim(),
        description: parent.description,
        due_at: parent.due_at,
        earliest_start_at: parent.earliest_start_at,
        estimated_minutes: child.remainingMinutes,
        remaining_minutes: child.remainingMinutes,
        priority: parent.priority,
        difficulty: parent.difficulty,
        status: parent.status,
        splittable: parent.splittable,
        minimum_block_minutes: parent.minimum_block_minutes,
        source: parent.source,
        course_id: parent.course_id,
        parent_task_id: parent.id,
        workflow_state: parent.workflow_state,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to create subtask");
    }

    childIds.push(data.id);
  }

  const { error: parentError } = await supabase
    .from("tasks")
    .update({
      remaining_minutes: childTotal,
      estimated_minutes: childTotal,
      splittable: true,
    })
    .eq("id", parent.id)
    .eq("user_id", user.id);

  if (parentError) {
    throw new DatabaseError("Failed to update parent task");
  }

  return { parentId: parent.id, childIds };
}

export async function listChildTasks(parentId: string): Promise<TaskRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("parent_task_id", parentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load subtasks");
  }

  return mapTaskRows(data ?? []);
}
