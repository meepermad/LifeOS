export type ConfidenceState = "insufficient" | "early_pattern" | "established";

export type MetricResult<T> = {
  value: T | null;
  sampleCount: number;
  coverage: number | null;
  confidence: ConfidenceState;
  excluded: number;
  description: string;
};

export function deriveConfidence(sampleCount: number): ConfidenceState {
  if (sampleCount < 3) return "insufficient";
  if (sampleCount < 8) return "early_pattern";
  return "established";
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function medianAbsoluteDeviation(values: number[], center: number): number | null {
  if (values.length === 0) return null;
  const deviations = values.map((v) => Math.abs(v - center));
  return median(deviations);
}

export type EstimationSample = {
  taskId: string;
  estimatedMinutes: number;
  actualMinutes: number;
  ratio: number;
};

export function buildEstimationSamples(input: {
  snapshots: Array<{
    task_id: string;
    original_estimate_minutes: number | null;
    final_actual_seconds: number;
    completed_at: string;
  }>;
  trackingEpoch: string;
}): { samples: EstimationSample[]; excluded: number } {
  let excluded = 0;
  const samples: EstimationSample[] = [];

  for (const snap of input.snapshots) {
    const estimate = snap.original_estimate_minutes;
    const actualMinutes = snap.final_actual_seconds / 60;

    if (!estimate || estimate <= 0) {
      excluded++;
      continue;
    }
    if (actualMinutes <= 0) {
      excluded++;
      continue;
    }
    if (new Date(snap.completed_at) < new Date(input.trackingEpoch)) {
      excluded++;
      continue;
    }
    if (actualMinutes > 24 * 60) {
      excluded++;
      continue;
    }

    samples.push({
      taskId: snap.task_id,
      estimatedMinutes: estimate,
      actualMinutes,
      ratio: actualMinutes / estimate,
    });
  }

  return { samples, excluded };
}

export function summarizeEstimationAccuracy(samples: EstimationSample[]): MetricResult<{
  medianRatio: number;
  medianAbsoluteError: number;
  underestimateRate: number;
  overestimateRate: number;
}> {
  const count = samples.length;
  const confidence = deriveConfidence(count);

  if (count === 0) {
    return {
      value: null,
      sampleCount: 0,
      coverage: null,
      confidence,
      excluded: 0,
      description: "Not enough completed tasks with usable time data yet.",
    };
  }

  const ratios = samples.map((s) => s.ratio);
  const medianRatio = median(ratios)!;
  const medianAbsoluteError = medianAbsoluteDeviation(ratios, 1)!;
  const underestimateRate =
    samples.filter((s) => s.ratio > 1.05).length / count;
  const overestimateRate =
    samples.filter((s) => s.ratio < 0.95).length / count;

  return {
    value: {
      medianRatio,
      medianAbsoluteError,
      underestimateRate,
      overestimateRate,
    },
    sampleCount: count,
    coverage: null,
    confidence,
    excluded: 0,
    description: `Based on ${count} completed task${count === 1 ? "" : "s"} with estimate and actual time.`,
  };
}

export function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
