/**
 * Actual-time authority model:
 * - task_time_entries (review_state valid|corrected): live tracked evidence
 * - task_completion_snapshots (is_current): reviewed value for calibration/analytics
 * - tasks.actual_minutes: cache of current snapshot only
 */

import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getTaskById } from "@/lib/data/tasks";
import { getActiveTimer } from "@/lib/data/time-entries";
import { DatabaseError } from "@/lib/errors/app-error";

export type CompletionSnapshotRow = {
  id: string;
  task_id: string;
  completed_at: string;
  original_estimate_minutes: number | null;
  current_estimate_minutes: number | null;
  tracked_seconds: number;
  adjustment_seconds: number;
  final_actual_seconds: number;
  estimate_revision_count: number;
  completion_sequence: number;
  is_current: boolean;
  correction_of_snapshot_id: string | null;
};

export type TimeEntryForReview = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entry_source: string;
  note: string | null;
  review_state: string;
  review_reason: string | null;
};

export type CompletionReviewPayload = {
  taskId: string;
  taskTitle: string;
  status: string;
  originalEstimateMinutes: number | null;
  currentEstimateMinutes: number | null;
  trackedSeconds: number;
  activeTimerSeconds: number;
  hasActiveTimer: boolean;
  isTimerPaused: boolean;
  entries: TimeEntryForReview[];
  proposedFinalSeconds: number;
  analyticsSource: "snapshot" | "tracked" | "none";
};

const REVIEWED_ENTRY_STATES = new Set(["valid", "corrected"]);

export function entryCountsForAnalytics(reviewState: string): boolean {
  return REVIEWED_ENTRY_STATES.has(reviewState);
}

export async function sumReviewedTrackedSeconds(taskId: string): Promise<number> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_time_entries")
    .select("duration_seconds, review_state, ended_at")
    .eq("user_id", user.id)
    .eq("task_id", taskId)
    .not("ended_at", "is", null);

  if (error) {
    throw new DatabaseError("Failed to sum tracked time");
  }

  return (data ?? []).reduce((sum, row) => {
    if (!entryCountsForAnalytics(row.review_state)) return sum;
    return sum + (row.duration_seconds ?? 0);
  }, 0);
}

export async function getCurrentCompletionSnapshot(
  taskId: string,
): Promise<CompletionSnapshotRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_completion_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .eq("task_id", taskId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load completion snapshot");
  }

  return data as CompletionSnapshotRow | null;
}

export async function buildCompletionReviewPayload(
  taskId: string,
): Promise<CompletionReviewPayload> {
  const task = await getTaskById(taskId);
  const active = await getActiveTimer();
  const hasActiveTimer = active?.entry.task_id === taskId;
  const activeTimerSeconds = hasActiveTimer ? active.elapsedSeconds : 0;

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: entries, error } = await supabase
    .from("task_time_entries")
    .select(
      "id, started_at, ended_at, duration_seconds, entry_source, note, review_state, review_reason",
    )
    .eq("user_id", user.id)
    .eq("task_id", taskId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new DatabaseError("Failed to load time entries");
  }

  const trackedSeconds = await sumReviewedTrackedSeconds(taskId);
  const proposedFinalSeconds = trackedSeconds + (hasActiveTimer ? activeTimerSeconds : 0);

  return {
    taskId: task.id,
    taskTitle: task.title,
    status: task.status,
    originalEstimateMinutes: task.estimated_minutes,
    currentEstimateMinutes: task.estimated_minutes,
    trackedSeconds,
    activeTimerSeconds,
    hasActiveTimer,
    isTimerPaused: hasActiveTimer ? active!.isPaused : false,
    entries: (entries ?? []) as TimeEntryForReview[],
    proposedFinalSeconds,
    analyticsSource: proposedFinalSeconds > 0 ? "tracked" : "none",
  };
}
