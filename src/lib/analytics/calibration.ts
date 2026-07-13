import { median } from "@/lib/analytics/metrics";

export type CalibrationGroupKey = {
  level: "course_category" | "category" | "course" | "domain" | "none";
  key: string;
};

export type CalibrationSample = {
  taskId: string;
  ratio: number;
  completedAt: string;
};

export type CalibrationResult = {
  group: CalibrationGroupKey;
  sampleCount: number;
  rawMedianRatio: number | null;
  appliedFactor: number;
  effectiveMinutes: (userEstimate: number) => number;
  reason: string;
};

const MIN_SAMPLES = 5;
const LOWER_BOUND = 0.75;
const UPPER_BOUND = 1.75;
const BLEND_DENOMINATOR = 7.5;

export function computeAppliedFactor(rawMedianRatio: number, sampleCount: number): number {
  if (sampleCount < MIN_SAMPLES) return 1;
  const blendWeight = sampleCount / (sampleCount + BLEND_DENOMINATOR);
  const rawAdjustment = rawMedianRatio - 1;
  const factor = 1 + rawAdjustment * blendWeight;
  return Math.min(UPPER_BOUND, Math.max(LOWER_BOUND, factor));
}

export function buildCalibrationReason(input: {
  factor: number;
  sampleCount: number;
  groupLabel: string;
}): string {
  if (input.sampleCount < MIN_SAMPLES) {
    return "Not enough completed tasks in this group for calibration yet.";
  }
  const pct = Math.round((input.factor - 1) * 100);
  if (pct === 0) return "Your recent tasks in this group matched your estimates.";
  const direction = pct > 0 ? "longer" : "shorter";
  return `Your last ${input.sampleCount} tasks in ${input.groupLabel} took about ${Math.abs(pct)}% ${direction} than estimated.`;
}

export function resolveCalibration(
  samplesByGroup: Map<string, CalibrationSample[]>,
  groupHierarchy: CalibrationGroupKey[],
  userEstimateMinutes: number | null,
): CalibrationResult {
  for (const group of groupHierarchy) {
    const samples = samplesByGroup.get(group.key) ?? [];
    if (samples.length < MIN_SAMPLES) continue;

    const ratios = samples.map((s) => s.ratio);
    const rawMedianRatio = median(ratios);
    if (rawMedianRatio == null) continue;

    const appliedFactor = computeAppliedFactor(rawMedianRatio, samples.length);
    return {
      group,
      sampleCount: samples.length,
      rawMedianRatio,
      appliedFactor,
      effectiveMinutes: (estimate) =>
        userEstimateMinutes == null
          ? estimate
          : Math.round(estimate * appliedFactor),
      reason: buildCalibrationReason({
        factor: appliedFactor,
        sampleCount: samples.length,
        groupLabel: group.key,
      }),
    };
  }

  return {
    group: { level: "none", key: "global" },
    sampleCount: 0,
    rawMedianRatio: null,
    appliedFactor: 1,
    effectiveMinutes: (estimate) => estimate,
    reason: "Using your original estimate — not enough calibration data.",
  };
}

export function getEffectiveEstimateMinutes(input: {
  userEstimate: number | null;
  calibration: CalibrationResult;
  adaptiveEnabled: boolean;
  override: "original" | "adaptive" | null;
}): { effective: number | null; factor: number; reason: string } {
  if (input.userEstimate == null) {
    return {
      effective: null,
      factor: 1,
      reason: "No estimate provided.",
    };
  }

  if (!input.adaptiveEnabled || input.override === "original") {
    return {
      effective: input.userEstimate,
      factor: 1,
      reason: "Using your original estimate.",
    };
  }

  const effective = input.calibration.effectiveMinutes(input.userEstimate);
  return {
    effective,
    factor: input.calibration.appliedFactor,
    reason: input.calibration.reason,
  };
}
