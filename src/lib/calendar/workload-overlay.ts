import type { DayWorkloadSummary } from "@/lib/planning/types";
import { formatMinutes } from "@/lib/planning/summaries";

export type DayWorkloadBadge = {
  dateKey: string;
  label: string;
  ariaLabel: string;
  intensity: "clear" | "moderate" | "high" | "overload";
  recommendedMinutes: number;
  availableMinutes: number;
};

const INTENSITY_LABELS: Record<string, string> = {
  clear: "Light day",
  moderate: "Moderate workload",
  manageable: "Manageable workload",
  high: "Busy day",
  overload: "Overloaded",
};

export function daySummaryToWorkloadBadge(
  summary: DayWorkloadSummary,
): DayWorkloadBadge {
  const intensity =
    summary.status === "manageable"
      ? "moderate"
      : (summary.status as DayWorkloadBadge["intensity"]);
  return {
    dateKey: summary.dateKey,
    label: INTENSITY_LABELS[summary.status] ?? summary.status,
    ariaLabel: `${INTENSITY_LABELS[summary.status] ?? summary.status}: ${formatMinutes(summary.recommendedTaskMinutes)} recommended of ${formatMinutes(summary.availableFocusMinutes)} available focus time`,
    intensity,
    recommendedMinutes: summary.recommendedTaskMinutes,
    availableMinutes: summary.availableFocusMinutes,
  };
}

export function buildWorkloadBadgesByDay(
  daySummaries: DayWorkloadSummary[],
): Map<string, DayWorkloadBadge> {
  const map = new Map<string, DayWorkloadBadge>();
  for (const summary of daySummaries) {
    map.set(summary.dateKey, daySummaryToWorkloadBadge(summary));
  }
  return map;
}
