import type { WorkloadStatus } from "@/types/domain";
import type { DayWorkloadSummary } from "@/lib/planning/types";
import { WORKLOAD_STATUS_THRESHOLDS } from "@/lib/planning/types";

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function workloadStatusLabel(status: WorkloadStatus): string {
  switch (status) {
    case "clear":
      return "Clear";
    case "manageable":
      return "Manageable";
    case "heavy":
      return "Heavy";
    case "overloaded":
      return "Overloaded";
    case "no_capacity":
      return "No capacity";
    case "incomplete_data":
      return "Incomplete data";
    default:
      return status;
  }
}

export function workloadStatusSentence(
  status: WorkloadStatus,
  periodLabel: "Today" | "This week",
): string {
  switch (status) {
    case "clear":
      return `${periodLabel} is clear`;
    case "manageable":
      return `${periodLabel} is manageable`;
    case "heavy":
      return `${periodLabel} is heavy`;
    case "overloaded":
      return `${periodLabel} is overloaded`;
    case "no_capacity":
      return `${periodLabel} has no available focus time`;
    case "incomplete_data":
      return `${periodLabel} needs more task estimates`;
    default:
      return `${periodLabel}: ${workloadStatusLabel(status)}`;
  }
}

export function deriveCapacityStatus(input: {
  availableFocusMinutes: number;
  allocatedTaskMinutes: number;
  requiredTaskMinutes: number;
  unallocatedTaskMinutes: number;
  hasIncompleteData: boolean;
}): WorkloadStatus {
  const {
    availableFocusMinutes,
    allocatedTaskMinutes,
    requiredTaskMinutes,
    unallocatedTaskMinutes,
    hasIncompleteData,
  } = input;

  const workMinutes = Math.max(allocatedTaskMinutes, requiredTaskMinutes);

  if (workMinutes === 0 && !hasIncompleteData) {
    return "clear";
  }

  if (availableFocusMinutes === 0 && workMinutes > 0) {
    return hasIncompleteData ? "incomplete_data" : "no_capacity";
  }

  if (unallocatedTaskMinutes > 0) {
    return hasIncompleteData ? "incomplete_data" : "overloaded";
  }

  if (availableFocusMinutes === 0) {
    return hasIncompleteData ? "incomplete_data" : "clear";
  }

  const ratio = allocatedTaskMinutes / availableFocusMinutes;

  if (ratio > WORKLOAD_STATUS_THRESHOLDS.heavyMax) {
    return hasIncompleteData ? "incomplete_data" : "overloaded";
  }

  if (ratio >= WORKLOAD_STATUS_THRESHOLDS.manageableMax) {
    return hasIncompleteData ? "incomplete_data" : "heavy";
  }

  if (hasIncompleteData && workMinutes > 0) {
    return "incomplete_data";
  }

  return "manageable";
}

export function derivePeriodStatus(input: {
  availableFocusMinutes: number;
  allocatedTaskMinutes: number;
  requiredTaskMinutes: number;
  unallocatedTaskMinutes: number;
  hasIncompleteData: boolean;
}): WorkloadStatus {
  const base = deriveCapacityStatus(input);

  if (input.hasIncompleteData && base !== "clear" && base !== "no_capacity") {
    return "incomplete_data";
  }

  if (
    input.hasIncompleteData &&
    input.requiredTaskMinutes === 0 &&
    input.allocatedTaskMinutes === 0
  ) {
    return "incomplete_data";
  }

  return base;
}

export function getHighestPressureDays(
  daySummaries: DayWorkloadSummary[],
  limit = 3,
): string[] {
  return [...daySummaries]
    .sort((a, b) => {
      const ratioA = a.capacityRatio ?? (a.recommendedTaskMinutes > 0 ? 999 : 0);
      const ratioB = b.capacityRatio ?? (b.recommendedTaskMinutes > 0 ? 999 : 0);
      if (ratioB !== ratioA) return ratioB - ratioA;
      return b.recommendedTaskMinutes - a.recommendedTaskMinutes;
    })
    .filter(
      (day) =>
        day.status === "heavy" ||
        day.status === "overloaded" ||
        day.status === "no_capacity" ||
        day.status === "incomplete_data",
    )
    .slice(0, limit)
    .map((day) => day.dateKey);
}

export function formatWorkloadExplanation(input: {
  needsAvailabilityConfiguration: boolean;
  hasIncompleteData: boolean;
  unestimatedTaskCount: number;
  tentativeEventCount: number;
  planningBufferPercent: number;
  travelBufferMinutes: number;
}): string[] {
  const lines: string[] = [
    "Available focus time starts from your enabled availability windows.",
    "Fixed commitments (classes, meetings, focus blocks, and similar events) are subtracted next.",
    `Travel-sensitive events include a ${input.travelBufferMinutes}-minute buffer before and after.`,
    `${input.planningBufferPercent}% of remaining open time is reserved as planning buffer.`,
    "Recommended task minutes come from analytical allocation across eligible days.",
    "These recommendations do not create calendar events.",
  ];

  if (input.needsAvailabilityConfiguration) {
    lines.unshift(
      "No availability is configured for one or more days, so focus time is zero until you add rules in Settings.",
    );
  }

  if (input.hasIncompleteData) {
    lines.push(
      `${input.unestimatedTaskCount} task(s) lack estimates, so the workload ratio may understate true demand.`,
    );
  }

  if (input.tentativeEventCount > 0) {
    lines.push(
      `${input.tentativeEventCount} tentative event(s) are shown as warnings and do not reduce capacity in this phase.`,
    );
  }

  return lines;
}
