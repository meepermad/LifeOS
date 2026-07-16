import {
  EVENING_REVIEW_STEPS,
  MORNING_REVIEW_STEPS,
  WEEKLY_REVIEW_STEPS,
} from "@/lib/reviews/types";

/** Map URL step aliases to canonical review step ids. */
export function resolveDailyReviewStepId(
  period: "morning" | "evening",
  stepParam: string | undefined,
): string | null {
  if (!stepParam) return null;
  if (stepParam === "planning-feedback") {
    return period === "evening" ? "feedback" : null;
  }
  const steps =
    period === "morning" ? MORNING_REVIEW_STEPS : EVENING_REVIEW_STEPS;
  return steps.some((s) => s.id === stepParam) ? stepParam : null;
}

export function resolveDailyReviewStepIndex(
  period: "morning" | "evening",
  stepParam: string | undefined,
  fallbackIndex: number,
): number {
  const stepId = resolveDailyReviewStepId(period, stepParam);
  if (!stepId) return fallbackIndex;
  const steps =
    period === "morning" ? MORNING_REVIEW_STEPS : EVENING_REVIEW_STEPS;
  const index = steps.findIndex((s) => s.id === stepId);
  return index >= 0 ? index : fallbackIndex;
}

/** Map capacity → planning; reject unknown steps. */
export function resolveWeeklyReviewStepIndex(
  stepParam: string | undefined,
  fallbackIndex: number,
): number {
  if (!stepParam) return fallbackIndex;
  const canonical = stepParam === "capacity" ? "planning" : stepParam;
  const index = WEEKLY_REVIEW_STEPS.findIndex((s) => s.id === canonical);
  return index >= 0 ? index : fallbackIndex;
}

export type TaskViewParam = "today" | "upcoming" | "overdue" | "waiting";

export function mapTaskViewToFilter(
  view: string | undefined,
): import("@/lib/data/tasks").TaskFilter | undefined {
  switch (view) {
    case "waiting":
      return "waiting";
    case "overdue":
      return "overdue";
    case "upcoming":
    case "today":
      return "due_this_week";
    default:
      return undefined;
  }
}

export function inferTaskViewFromTask(task: {
  status: string;
  workflow_state?: string | null;
  due_at: string | null;
}): TaskViewParam {
  if (task.workflow_state === "waiting") return "waiting";
  if (task.due_at && new Date(task.due_at).getTime() < Date.now()) {
    return "overdue";
  }
  return "upcoming";
}
