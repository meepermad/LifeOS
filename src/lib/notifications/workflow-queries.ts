import { isOverdue } from "@/lib/dates/timezone";
import { isActionableWorkload } from "@/lib/tasks/triage";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TaskRow } from "@/types/domain";

type DbClient = SupabaseClient<Database>;

export type ReviewSessionType = "morning_daily" | "evening_daily" | "weekly";

export async function hasCompletedReviewSession(
  client: DbClient,
  userId: string,
  reviewType: ReviewSessionType,
  scope: { dateKey?: string; weekStartKey?: string },
): Promise<boolean> {
  // review_sessions exists after Phase 13C migration; types regenerate on db push
  const reviewClient = client as unknown as SupabaseClient<
    Record<string, unknown>
  >;
  let query = reviewClient
    .from("review_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("review_type", reviewType)
    .not("completed_at", "is", null)
    .limit(1);

  if (reviewType === "weekly") {
    if (!scope.weekStartKey) return false;
    query = query.eq("review_week_start", scope.weekStartKey);
  } else {
    if (!scope.dateKey) return false;
    query = query.eq("review_date", scope.dateKey);
  }

  const { data, error } = await query;
  if (error) return false;
  const rows = (data ?? []) as Array<{ id: string }>;
  return rows.length > 0;
}

export async function countWaitingFollowupsDue(
  client: DbClient,
  userId: string,
  now = new Date(),
): Promise<number> {
  const { data, error } = await client
    .from("tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("workflow_state", "waiting")
    .not("waiting_follow_up_at", "is", null)
    .lte("waiting_follow_up_at", now.toISOString())
    .in("status", ["open", "in_progress", "deferred"]);

  if (error) return 0;
  return data?.length ?? 0;
}

export async function countOverdueNeedingDecision(
  client: DbClient,
  userId: string,
  now = new Date(),
): Promise<number> {
  const { data, error } = await client
    .from("tasks")
    .select(
      "id, due_at, inbox_at, workflow_state, deferred_until_at, sync_managed",
    )
    .eq("user_id", userId)
    .in("status", ["open", "in_progress"])
    .not("due_at", "is", null);

  if (error) return 0;

  return (data ?? []).filter((task) => {
    const row = task as TaskRow;
    return isOverdue(row.due_at!, now) && isActionableWorkload(row, now);
  }).length;
}

export async function countAwaitingPlanningFeedback(
  client: DbClient,
  userId: string,
  now = new Date(),
): Promise<number> {
  const nowIso = now.toISOString();

  const { data: events, error } = await client
    .from("events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "focus_block")
    .eq("status", "confirmed")
    .lt("end_at", nowIso);

  if (error || !events?.length) return 0;

  const eventIds = events.map((event) => event.id);
  const { data: feedback, error: feedbackError } = await client
    .from("planning_block_feedback")
    .select("event_id")
    .eq("user_id", userId)
    .in("event_id", eventIds);

  if (feedbackError) return 0;

  const feedbackIds = new Set((feedback ?? []).map((row) => row.event_id));
  return events.filter((event) => !feedbackIds.has(event.id)).length;
}

export async function countInboxTasks(
  client: DbClient,
  userId: string,
): Promise<number> {
  const { count, error } = await client
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("inbox_at", "is", null)
    .in("status", ["open", "in_progress", "deferred"]);

  if (error) return 0;
  return count ?? 0;
}
