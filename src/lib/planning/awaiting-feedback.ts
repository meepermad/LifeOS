import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { AwaitingFeedbackBlock } from "@/lib/reviews/types";

export async function listBlocksAwaitingFeedback(options?: {
  since?: string;
  until?: string;
}): Promise<AwaitingFeedbackBlock[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const since =
    options?.since ??
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const until = options?.until ?? now;

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_at, end_at, related_task_id")
    .eq("user_id", user.id)
    .eq("event_type", "focus_block")
    .neq("status", "cancelled")
    .gte("end_at", since)
    .lte("end_at", until)
    .order("end_at", { ascending: false });

  if (eventsError) {
    throw new DatabaseError("Failed to load focus blocks");
  }

  if (!events?.length) {
    return [];
  }

  const eventIds = events.map((event) => event.id);

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("planning_block_feedback")
    .select("event_id")
    .eq("user_id", user.id)
    .in("event_id", eventIds);

  if (feedbackError) {
    throw new DatabaseError("Failed to load planning feedback");
  }

  const feedbackEventIds = new Set(
    (feedbackRows ?? []).map((row) => row.event_id),
  );

  const taskIds = [
    ...new Set(
      events
        .map((event) => event.related_task_id)
        .filter((id): id is string => id != null),
    ),
  ];

  const taskTitleById = new Map<string, string>();
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("user_id", user.id)
      .in("id", taskIds);

    for (const task of tasks ?? []) {
      taskTitleById.set(task.id, task.title);
    }
  }

  return events
    .filter((event) => !feedbackEventIds.has(event.id))
    .map((event) => ({
      eventId: event.id,
      title: event.title,
      startAt: event.start_at,
      endAt: event.end_at,
      taskId: event.related_task_id,
      taskTitle: event.related_task_id
        ? (taskTitleById.get(event.related_task_id) ?? null)
        : null,
    }));
}

export async function countBlocksAwaitingFeedback(): Promise<number> {
  const blocks = await listBlocksAwaitingFeedback();
  return blocks.length;
}
