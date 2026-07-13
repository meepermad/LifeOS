import { formatAppDate } from "@/lib/dates/timezone";
import type { ProposalExplanation } from "@/lib/planning/types";

export function buildProposalExplanation(input: {
  reason: string;
  dueAt: string | null;
  availableIntervalMinutes: number;
  taskRemainingMinutes: number;
  scheduledTaskMinutesBeforeProposal: number;
  preferenceMatches: string[];
  preferenceViolations: string[];
  calibration?: ProposalExplanation["calibration"];
}): ProposalExplanation {
  return {
    reason: input.reason,
    dueAt: input.dueAt,
    availableIntervalMinutes: input.availableIntervalMinutes,
    taskRemainingMinutes: input.taskRemainingMinutes,
    scheduledTaskMinutesBeforeProposal: input.scheduledTaskMinutesBeforeProposal,
    preferenceMatches: input.preferenceMatches,
    preferenceViolations: input.preferenceViolations,
    calibration: input.calibration,
  };
}

const PREFERENCE_LABELS: Record<string, string> = {
  preferred_block_length: "your preferred focus length",
  before_difficult_work_cutoff: "your difficult-work cutoff",
  minimum_break: "minimum break spacing",
  spread_across_days: "spreading work across earlier days",
  earliest_due: "earliest due date",
};

const REASON_INTROS: Record<string, string> = {
  earliest_due_high_priority:
    "Scheduled here because this is a high-priority task",
  overdue_high_priority:
    "Scheduled here because this overdue task needs attention",
  splittable_spread: "Scheduled here to spread this task across available days",
  non_splittable_fit: "Scheduled here because the full block fits this open interval",
  only_available_slot: "Scheduled here because it was the only feasible open interval",
};

export function formatProposalExplanation(
  explanation: ProposalExplanation,
  taskTitle?: string,
): string {
  const parts: string[] = [];
  const intro =
    REASON_INTROS[explanation.reason] ??
    "Scheduled here based on your task priorities and availability";

  if (explanation.dueAt) {
    parts.push(
      `${intro}${taskTitle ? ` for “${taskTitle}”` : ""} due ${formatAppDate(explanation.dueAt, "EEEE")}.`,
    );
  } else {
    parts.push(`${intro}${taskTitle ? ` for “${taskTitle}”` : ""}.`);
  }

  if (explanation.preferenceMatches.length > 0) {
    const labels = explanation.preferenceMatches
      .map((key) => PREFERENCE_LABELS[key] ?? key.replaceAll("_", " "))
      .join(", ");
    parts.push(`The block fits ${labels}.`);
  }

  if (explanation.preferenceViolations.length > 0) {
    const labels = explanation.preferenceViolations
      .map((key) => PREFERENCE_LABELS[key] ?? key.replaceAll("_", " "))
      .join(", ");
    parts.push(`Note: could not fully honor ${labels}.`);
  }

  return parts.join(" ");
}

export function formatPreferenceWarnings(
  explanation: ProposalExplanation,
): string[] {
  return explanation.preferenceViolations.map((violation) => {
    const label = PREFERENCE_LABELS[violation] ?? violation.replaceAll("_", " ");
    return `Could not fully honor ${label}.`;
  });
}
