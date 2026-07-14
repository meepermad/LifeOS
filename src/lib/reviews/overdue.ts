import { getAppLocalDateKey, isOverdue, nowInAppTimezone } from "@/lib/dates/timezone";
import { listTasks } from "@/lib/data/tasks";
import { listReviewDecisionsForSession } from "@/lib/data/reviews";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { DatabaseError } from "@/lib/errors/app-error";
import { isActionableWorkload } from "@/lib/tasks/triage";
import type { TaskRow } from "@/types/domain";
import type { ReviewSessionRow } from "@/lib/reviews/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export const OVERDUE_DECISION_TYPES = new Set([
  "keep_due_date",
  "move_due_date",
  "change_deadline",
  "schedule_tomorrow",
  "return_to_inbox",
  "split_task",
  "reduce_scope",
  "mark_waiting",
  "cancel",
  "defer",
  "acknowledge",
]);

function mapSessionRow(row: Record<string, unknown>): ReviewSessionRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    review_type: row.review_type as ReviewSessionRow["review_type"],
    review_date: (row.review_date as string | null) ?? null,
    review_week_start: (row.review_week_start as string | null) ?? null,
    started_at: row.started_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
    current_step: typeof row.current_step === "number" ? row.current_step : 0,
    summary_json: (row.summary_json as Record<string, unknown> | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function listReviewSessionsForDate(
  dateKey: string,
): Promise<ReviewSessionRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("review_date", dateKey)
    .in("review_type", ["morning_daily", "evening_daily"]);

  if (error) {
    throw new DatabaseError("Failed to load review sessions");
  }

  return (data ?? []).map((row) => mapSessionRow(row as Record<string, unknown>));
}

export function isOverdueCandidateNeedingDecision(
  task: TaskRow,
  now: Date,
  decidedTaskIds: Set<string>,
): boolean {
  return (
    !task.parent_task_id &&
    Boolean(task.due_at) &&
    isOverdue(task.due_at!, now) &&
    isActionableWorkload(task, now) &&
    !decidedTaskIds.has(task.id)
  );
}

export async function collectDecidedOverdueTaskIds(
  client: SupabaseClient<Database>,
  userId: string,
  dateKey: string,
): Promise<Set<string>> {
  const reviewClient = client as unknown as SupabaseClient<
    Record<string, unknown>
  >;

  const { data: sessions, error } = await reviewClient
    .from("review_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("review_date", dateKey)
    .in("review_type", ["morning_daily", "evening_daily"]);

  if (error || !sessions?.length) {
    return new Set();
  }

  const sessionIds = (sessions as Array<{ id: string }>).map(
    (session) => session.id,
  );
  const decidedTaskIds = new Set<string>();

  const { data: decisions, error: decisionsError } = await reviewClient
    .from("review_decisions")
    .select("task_id, decision_type")
    .eq("user_id", userId)
    .in("session_id", sessionIds);

  if (decisionsError) {
    return decidedTaskIds;
  }

  for (const decision of (decisions ?? []) as Array<{
    task_id: string | null;
    decision_type: string;
  }>) {
    if (
      decision.task_id &&
      OVERDUE_DECISION_TYPES.has(decision.decision_type)
    ) {
      decidedTaskIds.add(decision.task_id);
    }
  }

  return decidedTaskIds;
}

export async function getOverdueTasksNeedingDecision(
  dateKey?: string,
): Promise<TaskRow[]> {
  const now = nowInAppTimezone();
  const key = dateKey ?? getAppLocalDateKey(now);

  const tasks = await listTasks({ status: "active", sort: "due_date" });
  const overdue = tasks.filter(
    (task) =>
      !task.parent_task_id &&
      task.due_at &&
      isOverdue(task.due_at, now) &&
      isActionableWorkload(task, now),
  );

  if (overdue.length === 0) return [];

  const sessions = await listReviewSessionsForDate(key);
  const decidedTaskIds = new Set<string>();

  for (const session of sessions) {
    const decisions = await listReviewDecisionsForSession(session.id);
    for (const decision of decisions) {
      if (
        decision.task_id &&
        OVERDUE_DECISION_TYPES.has(decision.decision_type)
      ) {
        decidedTaskIds.add(decision.task_id);
      }
    }
  }

  return overdue.filter((task) =>
    isOverdueCandidateNeedingDecision(task, now, decidedTaskIds),
  );
}
