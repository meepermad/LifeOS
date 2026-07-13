import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { DatabaseError } from "@/lib/errors/app-error";
import {
  buildEstimationSamples,
  formatDurationMinutes,
  summarizeEstimationAccuracy,
  type MetricResult,
} from "@/lib/analytics/metrics";
import { listEntriesForRange } from "@/lib/data/time-entries";

export type InsightsDateRange = {
  start: string;
  end: string;
  label: string;
};

export type InsightsPayload = {
  range: InsightsDateRange;
  liveTrackedMinutes: MetricResult<number>;
  reviewedActualMinutes: MetricResult<number>;
  completedTasks: MetricResult<number>;
  completionRate: MetricResult<number>;
  estimationAccuracy: ReturnType<typeof summarizeEstimationAccuracy>;
  weeklyTrackedMinutes: Array<{ weekLabel: string; minutes: number }>;
  hoursBySource: Array<{ source: string; minutes: number }>;
};

import { PHASE12_TRACKING_EPOCH } from "@/lib/analytics/constants";

export async function loadInsights(
  range: InsightsDateRange,
): Promise<InsightsPayload> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const [entries, completedResult, snapshotsResult] = await Promise.all([
    listEntriesForRange(range.start, range.end),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("completed_at", range.start)
      .lte("completed_at", range.end),
    supabase
      .from("task_completion_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .gte("completed_at", range.start)
      .lte("completed_at", range.end),
  ]);

  if (completedResult.error) {
    throw new DatabaseError("Failed to load completed tasks");
  }
  if (snapshotsResult.error) {
    throw new DatabaseError("Failed to load completion snapshots");
  }

  const validEntries = entries.filter(
    (e) => e.review_state === "valid" || e.review_state === "corrected",
  );
  const excludedEntries = entries.length - validEntries.length;

  const trackedSeconds = validEntries.reduce(
    (sum, e) => sum + (e.duration_seconds ?? 0),
    0,
  );
  const trackedMinutes = trackedSeconds / 60;

  const currentSnapshots = (snapshotsResult.data ?? []).filter(
    (s) => s.is_current !== false,
  );
  const reviewedSeconds = currentSnapshots.reduce(
    (sum, s) => sum + (s.final_actual_seconds ?? 0),
    0,
  );
  const reviewedMinutes = reviewedSeconds / 60;
  const completedCount = completedResult.count ?? 0;
  const snapshotCount = currentSnapshots.length;

  const { samples, excluded } = buildEstimationSamples({
    snapshots: currentSnapshots,
    trackingEpoch: PHASE12_TRACKING_EPOCH,
  });
  const estimationAccuracy = summarizeEstimationAccuracy(samples);
  estimationAccuracy.excluded = excluded;

  const sourceMap = new Map<string, number>();
  for (const entry of validEntries) {
    const key = entry.entry_source;
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + (entry.duration_seconds ?? 0) / 60);
  }

  const hoursBySource = [...sourceMap.entries()].map(([source, minutes]) => ({
    source,
    minutes,
  }));

  const completionRate =
    completedCount > 0 && snapshotCount > 0
      ? snapshotCount / completedCount
      : 0;

  return {
    range,
    liveTrackedMinutes: {
      value: trackedMinutes,
      sampleCount: validEntries.length,
      coverage: entries.length > 0 ? validEntries.length / entries.length : null,
      confidence:
        validEntries.length < 3
          ? "insufficient"
          : validEntries.length < 8
            ? "early_pattern"
            : "established",
      excluded: excludedEntries,
      description: `Live tracked ${formatDurationMinutes(trackedMinutes)} from ${validEntries.length} valid entries (${excludedEntries} excluded).`,
    },
    reviewedActualMinutes: {
      value: reviewedMinutes,
      sampleCount: snapshotCount,
      coverage: completedCount > 0 ? snapshotCount / completedCount : null,
      confidence:
        snapshotCount < 3
          ? "insufficient"
          : snapshotCount < 8
            ? "early_pattern"
            : "established",
      excluded: (snapshotsResult.data?.length ?? 0) - snapshotCount,
      description: `Reviewed actual time ${formatDurationMinutes(reviewedMinutes)} from ${snapshotCount} completion snapshots.`,
    },
    completedTasks: {
      value: completedCount,
      sampleCount: completedCount,
      coverage: null,
      confidence: completedCount < 3 ? "insufficient" : completedCount < 8 ? "early_pattern" : "established",
      excluded: 0,
      description: `Completed ${completedCount} task${completedCount === 1 ? "" : "s"} in this range.`,
    },
    completionRate: {
      value: completionRate,
      sampleCount: completedCount,
      coverage: completionRate,
      confidence: completedCount < 3 ? "insufficient" : "established",
      excluded: completedCount - snapshotCount,
      description: `${Math.round(completionRate * 100)}% of completions have reviewed snapshots.`,
    },
    estimationAccuracy,
    weeklyTrackedMinutes: [
      { weekLabel: range.label, minutes: trackedMinutes },
    ],
    hoursBySource,
  };
}
