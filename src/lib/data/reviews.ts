import { DatabaseError, ValidationError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type {
  DailyPriorityRow,
  DailyPriorityWithTask,
  PriorityLevel,
  ReviewDecisionRow,
  ReviewDecisionType,
  ReviewSessionRow,
  ReviewType,
  WeeklyPriorityRow,
  WeeklyPriorityWithTask,
} from "@/lib/reviews/types";
import type { Json, Database } from "@/types/database.types";
import type { TaskRow } from "@/types/domain";

const MAX_DAILY_PRIORITIES = 3;
const MAX_WEEKLY_PRIORITIES = 5;

function mapSession(row: Record<string, unknown>): ReviewSessionRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    review_type: row.review_type as ReviewType,
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

function mapDecision(row: Record<string, unknown>): ReviewDecisionRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    session_id: row.session_id as string,
    task_id: (row.task_id as string | null) ?? null,
    decision_type: row.decision_type as ReviewDecisionType,
    decision_payload:
      (row.decision_payload as Record<string, unknown> | null) ?? null,
    supersedes_decision_id:
      (row.supersedes_decision_id as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

function assertUniquePriorityRanks(
  priorities: Array<{ taskId: string; priorityRank: number }>,
  max: number,
): void {
  if (priorities.length > max) {
    throw new ValidationError(`At most ${max} priorities allowed`);
  }

  const taskIds = new Set(priorities.map((priority) => priority.taskId));
  if (taskIds.size !== priorities.length) {
    throw new ValidationError("Priority task ids must be unique");
  }

  const ranks = priorities.map((priority) => priority.priorityRank).sort(
    (a, b) => a - b,
  );
  const expected = Array.from({ length: priorities.length }, (_, index) => index + 1);
  if (ranks.join(",") !== expected.join(",")) {
    throw new ValidationError("Priority ranks must be unique and contiguous from 1");
  }
}

function mapDailyPriority(row: Record<string, unknown>): DailyPriorityRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    priority_date: row.priority_date as string,
    task_id: row.task_id as string,
    priority_rank: row.priority_rank as number,
    priority_level: row.priority_level as PriorityLevel,
    created_at: row.created_at as string,
  };
}

function mapWeeklyPriority(row: Record<string, unknown>): WeeklyPriorityRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    week_start_date: row.week_start_date as string,
    task_id: row.task_id as string,
    priority_rank: row.priority_rank as number,
    created_at: row.created_at as string,
  };
}

type SessionScope =
  | { reviewType: "weekly"; reviewWeekStart: string }
  | { reviewType: "morning_daily" | "evening_daily"; reviewDate: string };

export async function getInProgressReviewSession(
  scope: SessionScope,
): Promise<ReviewSessionRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  let query = supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("review_type", scope.reviewType)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1);

  if (scope.reviewType === "weekly") {
    query = query.eq("review_week_start", scope.reviewWeekStart);
  } else {
    query = query.eq("review_date", scope.reviewDate);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load review session");
  }

  return data ? mapSession(data as Record<string, unknown>) : null;
}

export async function getCompletedReviewSession(
  scope: SessionScope,
): Promise<ReviewSessionRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  let query = supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("review_type", scope.reviewType)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1);

  if (scope.reviewType === "weekly") {
    query = query.eq("review_week_start", scope.reviewWeekStart);
  } else {
    query = query.eq("review_date", scope.reviewDate);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load completed review session");
  }

  return data ? mapSession(data as Record<string, unknown>) : null;
}

export async function getReviewSessionById(
  sessionId: string,
): Promise<ReviewSessionRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new DatabaseError("Review session not found");
  }

  return mapSession(data as Record<string, unknown>);
}

export async function startReviewSession(
  input: SessionScope,
): Promise<{ session: ReviewSessionRow; created: boolean }> {
  const existing = await getInProgressReviewSession(input);
  if (existing) {
    return { session: existing, created: false };
  }

  const completed = await getCompletedReviewSession(input);
  if (completed) {
    return { session: completed, created: false };
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const payload =
    input.reviewType === "weekly"
      ? {
          user_id: user.id,
          review_type: input.reviewType,
          review_week_start: input.reviewWeekStart,
          review_date: null,
        }
      : {
          user_id: user.id,
          review_type: input.reviewType,
          review_date: input.reviewDate,
          review_week_start: null,
        };

  const { data, error } = await supabase
    .from("review_sessions")
    .insert(payload as Database["public"]["Tables"]["review_sessions"]["Insert"])
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existingAfterConflict = await getInProgressReviewSession(input);
      if (existingAfterConflict) {
        return { session: existingAfterConflict, created: false };
      }
    }
    throw new DatabaseError("Failed to start review session");
  }

  if (!data) {
    throw new DatabaseError("Failed to start review session");
  }

  return {
    session: mapSession(data as Record<string, unknown>),
    created: true,
  };
}

export async function updateSessionStep(
  sessionId: string,
  step: number,
): Promise<ReviewSessionRow> {
  if (!Number.isInteger(step) || step < 0) {
    throw new ValidationError("Step must be a non-negative integer");
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  await getReviewSessionById(sessionId);

  const { data, error } = await supabase
    .from("review_sessions")
    .update({ current_step: step })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update review session step");
  }

  return mapSession(data as Record<string, unknown>);
}

export async function completeReviewSession(
  sessionId: string,
  summary?: Json | null,
): Promise<{ session: ReviewSessionRow; idempotent: boolean }> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const session = await getReviewSessionById(sessionId);

  if (session.completed_at) {
    return { session, idempotent: true };
  }

  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("review_sessions")
    .update({
      completed_at: completedAt,
      summary_json: (summary ?? session.summary_json) as Json | null,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const scope =
        session.review_type === "weekly"
          ? {
              reviewType: session.review_type,
              reviewWeekStart: session.review_week_start!,
            }
          : {
              reviewType: session.review_type,
              reviewDate: session.review_date!,
            };
      const existing = await getCompletedReviewSession(scope);
      if (existing) {
        return { session: existing, idempotent: true };
      }
    }
    throw new DatabaseError("Failed to complete review session");
  }

  if (!data) {
    throw new DatabaseError("Failed to complete review session");
  }

  return {
    session: mapSession(data as Record<string, unknown>),
    idempotent: false,
  };
}

export async function recordReviewDecision(input: {
  sessionId: string;
  taskId?: string | null;
  decisionType: ReviewDecisionType;
  decisionPayload?: Record<string, unknown> | null;
}): Promise<ReviewDecisionRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  await getReviewSessionById(input.sessionId);

  if (input.taskId) {
    const { data: existing } = await supabase
      .from("review_decisions")
      .select("*")
      .eq("user_id", user.id)
      .eq("session_id", input.sessionId)
      .eq("task_id", input.taskId)
      .eq("decision_type", input.decisionType)
      .maybeSingle();

    if (existing) {
      return mapDecision(existing as Record<string, unknown>);
    }
  }

  const { data, error } = await supabase
    .from("review_decisions")
    .insert({
      user_id: user.id,
      session_id: input.sessionId,
      task_id: input.taskId ?? null,
      decision_type: input.decisionType,
      decision_payload: (input.decisionPayload ?? null) as Json | null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to record review decision");
  }

  return mapDecision(data as Record<string, unknown>);
}

export async function listReviewDecisionsForSession(
  sessionId: string,
): Promise<ReviewDecisionRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("review_decisions")
    .select("*")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load review decisions");
  }

  return (data ?? []).map((row) => mapDecision(row as Record<string, unknown>));
}

async function attachTaskTitles<T extends { task_id: string }>(
  rows: T[],
): Promise<Array<T & { task: Pick<TaskRow, "id" | "title" | "due_at" | "status"> }>> {
  if (rows.length === 0) return [];

  const user = await requireAllowedUser();
  const supabase = await createClient();
  const taskIds = rows.map((row) => row.task_id);

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, due_at, status")
    .eq("user_id", user.id)
    .in("id", taskIds);

  if (error) {
    throw new DatabaseError("Failed to load priority tasks");
  }

  const taskById = new Map((tasks ?? []).map((task) => [task.id, task]));

  return rows
    .map((row) => {
      const task = taskById.get(row.task_id);
      if (!task) return null;
      return { ...row, task };
    })
    .filter(
      (
        row,
      ): row is T & {
        task: Pick<TaskRow, "id" | "title" | "due_at" | "status">;
      } => row != null,
    );
}

export async function getDailyPriorities(
  priorityDate: string,
): Promise<DailyPriorityWithTask[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("daily_priorities")
    .select("*")
    .eq("user_id", user.id)
    .eq("priority_date", priorityDate)
    .order("priority_rank", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load daily priorities");
  }

  const rows = (data ?? []).map((row) =>
    mapDailyPriority(row as Record<string, unknown>),
  );
  return attachTaskTitles(rows);
}

export async function saveDailyPriorities(input: {
  priorityDate: string;
  priorities: Array<{
    taskId: string;
    priorityRank: number;
    priorityLevel?: PriorityLevel;
  }>;
}): Promise<DailyPriorityWithTask[]> {
  assertUniquePriorityRanks(input.priorities, MAX_DAILY_PRIORITIES);

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("daily_priorities")
    .delete()
    .eq("user_id", user.id)
    .eq("priority_date", input.priorityDate);

  if (deleteError) {
    throw new DatabaseError("Failed to update daily priorities");
  }

  if (input.priorities.length === 0) {
    return [];
  }

  const { error: insertError } = await supabase.from("daily_priorities").insert(
    input.priorities.map((priority) => ({
      user_id: user.id,
      priority_date: input.priorityDate,
      task_id: priority.taskId,
      priority_rank: priority.priorityRank,
      priority_level: priority.priorityLevel ?? "primary",
    })),
  );

  if (insertError) {
    throw new DatabaseError("Failed to save daily priorities");
  }

  return getDailyPriorities(input.priorityDate);
}

export async function getWeeklyPriorities(
  weekStartDate: string,
): Promise<WeeklyPriorityWithTask[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("weekly_priorities")
    .select("*")
    .eq("user_id", user.id)
    .eq("week_start_date", weekStartDate)
    .order("priority_rank", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load weekly priorities");
  }

  const rows = (data ?? []).map((row) =>
    mapWeeklyPriority(row as Record<string, unknown>),
  );
  return attachTaskTitles(rows);
}

export async function saveWeeklyPriorities(input: {
  weekStartDate: string;
  priorities: Array<{ taskId: string; priorityRank: number }>;
}): Promise<WeeklyPriorityWithTask[]> {
  assertUniquePriorityRanks(input.priorities, MAX_WEEKLY_PRIORITIES);

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("weekly_priorities")
    .delete()
    .eq("user_id", user.id)
    .eq("week_start_date", input.weekStartDate);

  if (deleteError) {
    throw new DatabaseError("Failed to update weekly priorities");
  }

  if (input.priorities.length === 0) {
    return [];
  }

  const { error: insertError } = await supabase.from("weekly_priorities").insert(
    input.priorities.map((priority) => ({
      user_id: user.id,
      week_start_date: input.weekStartDate,
      task_id: priority.taskId,
      priority_rank: priority.priorityRank,
    })),
  );

  if (insertError) {
    throw new DatabaseError("Failed to save weekly priorities");
  }

  return getWeeklyPriorities(input.weekStartDate);
}

export async function deleteReviewSession(sessionId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("review_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete review session");
  }
}
