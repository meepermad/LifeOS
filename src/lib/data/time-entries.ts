import { ConflictError, DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getTaskById } from "@/lib/data/tasks";

export type TimeEntryRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  task_title_snapshot: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entry_source: string;
  note: string | null;
  parent_entry_id: string | null;
  review_state: string;
  review_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PauseSegmentRow = {
  id: string;
  entry_id: string;
  paused_at: string;
  resumed_at: string | null;
};

export type ActiveTimerState = {
  entry: TimeEntryRow;
  pauseSegments: PauseSegmentRow[];
  isPaused: boolean;
  elapsedSeconds: number;
};

import { checkEntryQuality } from "@/lib/time/entry-quality";

export { computeElapsedSeconds };

async function clearStaleTimerNotification(): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  await supabase
    .from("planning_preferences")
    .update({ stale_timer_notified_at: null })
    .eq("user_id", user.id);
}

function computeElapsedSeconds(
  entry: TimeEntryRow,
  pauseSegments: PauseSegmentRow[],
  now = new Date(),
): number {
  const startMs = new Date(entry.started_at).getTime();
  const endMs = entry.ended_at
    ? new Date(entry.ended_at).getTime()
    : now.getTime();

  let pausedMs = 0;
  for (const segment of pauseSegments) {
    const pauseStart = new Date(segment.paused_at).getTime();
    const pauseEnd = segment.resumed_at
      ? new Date(segment.resumed_at).getTime()
      : entry.ended_at
        ? new Date(entry.ended_at).getTime()
        : now.getTime();
    pausedMs += Math.max(0, pauseEnd - pauseStart);
  }

  return Math.max(0, Math.floor((endMs - startMs - pausedMs) / 1000));
}

async function verifyTaskOwnership(taskId: string): Promise<{ id: string; title: string }> {
  const task = await getTaskById(taskId);
  return { id: task.id, title: task.title };
}

export async function getActiveTimer(): Promise<ActiveTimerState | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: entry, error } = await supabase
    .from("task_time_entries")
    .select("*")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .eq("entry_source", "timer")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load active timer");
  }
  if (!entry) return null;

  const { data: pauseSegments } = await supabase
    .from("timer_pause_segments")
    .select("*")
    .eq("entry_id", entry.id)
    .order("paused_at", { ascending: true });

  const segments = pauseSegments ?? [];
  const isPaused = segments.some((s) => s.resumed_at == null);
  const elapsedSeconds = computeElapsedSeconds(entry, segments);

  return {
    entry,
    pauseSegments: segments,
    isPaused,
    elapsedSeconds,
  };
}

export async function startTimer(taskId: string): Promise<ActiveTimerState> {
  const user = await requireAllowedUser();
  const task = await verifyTaskOwnership(taskId);
  const supabase = await createClient();

  const existing = await getActiveTimer();
  if (existing) {
    throw new ConflictError(
      "A timer is already running. Stop it or switch tasks first.",
    );
  }

  const { data, error } = await supabase
    .from("task_time_entries")
    .insert({
      user_id: user.id,
      task_id: task.id,
      task_title_snapshot: task.title,
      started_at: new Date().toISOString(),
      entry_source: "timer",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to start timer");
  }

  return {
    entry: data,
    pauseSegments: [],
    isPaused: false,
    elapsedSeconds: 0,
  };
}

export async function pauseTimer(): Promise<ActiveTimerState> {
  const user = await requireAllowedUser();
  const active = await getActiveTimer();
  if (!active) {
    throw new ConflictError("No active timer to pause");
  }
  if (active.isPaused) {
    throw new ConflictError("Timer is already paused");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("timer_pause_segments").insert({
    user_id: user.id,
    entry_id: active.entry.id,
    paused_at: new Date().toISOString(),
  });

  if (error) {
    throw new DatabaseError("Failed to pause timer");
  }

  const refreshed = await getActiveTimer();
  if (!refreshed) {
    throw new DatabaseError("Timer state lost after pause");
  }
  return refreshed;
}

export async function resumeTimer(): Promise<ActiveTimerState> {
  const active = await getActiveTimer();
  if (!active) {
    throw new ConflictError("No active timer to resume");
  }
  if (!active.isPaused) {
    throw new ConflictError("Timer is not paused");
  }

  const openSegment = active.pauseSegments.find((s) => s.resumed_at == null);
  if (!openSegment) {
    throw new ConflictError("No open pause segment found");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("timer_pause_segments")
    .update({ resumed_at: new Date().toISOString() })
    .eq("id", openSegment.id)
    .eq("user_id", (await requireAllowedUser()).id);

  if (error) {
    throw new DatabaseError("Failed to resume timer");
  }

  const refreshed = await getActiveTimer();
  if (!refreshed) {
    throw new DatabaseError("Timer state lost after resume");
  }
  return refreshed;
}

export async function stopTimer(endedAt?: string): Promise<TimeEntryRow> {
  const active = await getActiveTimer();
  if (!active) {
    throw new ConflictError("No active timer to stop");
  }

  const end = endedAt ?? new Date().toISOString();
  const elapsedSeconds = computeElapsedSeconds(
    { ...active.entry, ended_at: end },
    active.pauseSegments,
    new Date(end),
  );

  const supabase = await createClient();
  const user = await requireAllowedUser();

  if (active.isPaused) {
    const openSegment = active.pauseSegments.find((s) => s.resumed_at == null);
    if (openSegment) {
      await supabase
        .from("timer_pause_segments")
        .update({ resumed_at: end })
        .eq("id", openSegment.id)
        .eq("user_id", user.id);
    }
  }

  const quality = checkEntryQuality(
    {
      started_at: active.entry.started_at,
      ended_at: end,
      duration_seconds: elapsedSeconds,
      entry_source: "timer",
    },
    { pauseSegments: active.pauseSegments },
  );

  const { data, error } = await supabase
    .from("task_time_entries")
    .update({
      ended_at: end,
      duration_seconds: elapsedSeconds,
      review_state: quality.needsReview ? "needs_review" : "valid",
      review_reason: quality.reviewReason,
    })
    .eq("id", active.entry.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to stop timer");
  }

  await clearStaleTimerNotification();

  return data;
}

export async function discardTimer(): Promise<void> {
  const active = await getActiveTimer();
  if (!active) return;

  const supabase = await createClient();
  const user = await requireAllowedUser();

  await supabase
    .from("timer_pause_segments")
    .delete()
    .eq("entry_id", active.entry.id)
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("task_time_entries")
    .delete()
    .eq("id", active.entry.id)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to discard timer");
  }

  await clearStaleTimerNotification();
}

export async function switchTimer(taskId: string): Promise<ActiveTimerState> {
  await stopTimer();
  return startTimer(taskId);
}

export async function createManualEntry(input: {
  taskId: string;
  startedAt: string;
  endedAt: string;
  note?: string | null;
}): Promise<TimeEntryRow> {
  const user = await requireAllowedUser();
  const task = await verifyTaskOwnership(input.taskId);
  const startMs = new Date(input.startedAt).getTime();
  const endMs = new Date(input.endedAt).getTime();

  if (endMs <= startMs) {
    throw new ConflictError("End time must be after start time");
  }

  const durationSeconds = Math.floor((endMs - startMs) / 1000);
  const supabase = await createClient();

  const quality = checkEntryQuality({
    started_at: input.startedAt,
    ended_at: input.endedAt,
    duration_seconds: durationSeconds,
    entry_source: "manual",
  });

  const { data, error } = await supabase
    .from("task_time_entries")
    .insert({
      user_id: user.id,
      task_id: task.id,
      task_title_snapshot: task.title,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      duration_seconds: durationSeconds,
      entry_source: "manual",
      note: input.note ?? null,
      review_state: quality.needsReview ? "needs_review" : "valid",
      review_reason: quality.reviewReason,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create time entry");
  }

  return data;
}

export async function deleteTimeEntry(entryId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_time_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete time entry");
  }
}

export async function sumTrackedSecondsForTask(taskId: string): Promise<number> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_time_entries")
    .select("duration_seconds, review_state")
    .eq("user_id", user.id)
    .eq("task_id", taskId)
    .not("duration_seconds", "is", null)
    .in("review_state", ["valid", "corrected"]);

  if (error) {
    throw new DatabaseError("Failed to sum tracked time");
  }

  return (data ?? []).reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
}

export async function listEntriesForRange(
  start: string,
  end: string,
): Promise<TimeEntryRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_time_entries")
    .select("*")
    .eq("user_id", user.id)
    .gte("started_at", start)
    .lte("started_at", end)
    .order("started_at", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to list time entries");
  }

  return data ?? [];
}

export function detectEntryOverlaps(
  entries: TimeEntryRow[],
  candidate: { startedAt: string; endedAt: string; excludeId?: string },
): TimeEntryRow[] {
  const start = new Date(candidate.startedAt).getTime();
  const end = new Date(candidate.endedAt).getTime();

  return entries.filter((entry) => {
    if (candidate.excludeId && entry.id === candidate.excludeId) return false;
    if (!entry.ended_at) return false;
    const eStart = new Date(entry.started_at).getTime();
    const eEnd = new Date(entry.ended_at).getTime();
    return start < eEnd && end > eStart;
  });
}
