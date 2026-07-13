import type {
  EveningReviewContext,
  MorningReviewContext,
  ReviewInsight,
  WeeklyReviewContext,
} from "@/lib/reviews/types";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function buildMorningInsights(
  context: MorningReviewContext,
): ReviewInsight[] {
  const insights: ReviewInsight[] = [];

  if (context.staleTimer && context.activeTimer) {
    insights.push({
      id: "stale-timer",
      text: `You have a timer running on “${context.activeTimer.entry.task_title_snapshot ?? "a task"}” that may need correction.`,
    });
  }

  if (context.overdue.length > 0) {
    insights.push({
      id: "overdue",
      text: `You have ${pluralize(context.overdue.length, "overdue task")} needing attention.`,
    });
  }

  const blockingEvents = context.events.filter(
    (event) => event.event_type === "class" || event.event_type === "work",
  );
  if (blockingEvents.length > 0) {
    insights.push({
      id: "schedule",
      text: `Today includes ${pluralize(blockingEvents.length, "fixed commitment", "fixed commitments")}.`,
    });
  }

  if (context.dueToday.length > 0) {
    insights.push({
      id: "due-today",
      text: `${pluralize(context.dueToday.length, "task")} due today.`,
    });
  }

  if (context.inboxCount > 0) {
    insights.push({
      id: "inbox",
      text: `${pluralize(context.inboxCount, "item")} in your inbox.`,
    });
  }

  if (context.workload) {
    const day = context.workload.daySummaries[0];
    if (day?.status === "overloaded") {
      insights.push({
        id: "overload",
        text: "Today looks overloaded compared to available focus time.",
      });
    } else if (context.workload.unallocatedTaskMinutes > 0) {
      insights.push({
        id: "unscheduled",
        text: `About ${context.workload.unallocatedTaskMinutes} minutes of estimated work is not yet scheduled.`,
      });
    }
  }

  const pendingProposals =
    context.planningRun?.proposals.filter((p) => p.status === "pending")
      .length ?? 0;
  if (pendingProposals > 0) {
    insights.push({
      id: "planning",
      text: `${pluralize(pendingProposals, "planning proposal")} waiting for your review.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "clear",
      text: "Your morning looks clear. Confirm priorities and start the day.",
    });
  }

  return insights;
}

export function buildEveningInsights(
  context: EveningReviewContext,
): ReviewInsight[] {
  const insights: ReviewInsight[] = [];

  if (context.completedToday.length > 0) {
    insights.push({
      id: "completed",
      text: `You completed ${pluralize(context.completedToday.length, "task")} today.`,
    });
  } else {
    insights.push({
      id: "no-completions",
      text: "No tasks were marked completed today.",
    });
  }

  if (context.unfinished.length > 0) {
    insights.push({
      id: "unfinished",
      text: `${pluralize(context.unfinished.length, "task")} still open from today.`,
    });
  }

  if (context.awaitingFeedback.length > 0) {
    insights.push({
      id: "feedback",
      text: `${pluralize(context.awaitingFeedback.length, "planning block")} need feedback.`,
    });
  }

  if (context.inboxCount > 0) {
    insights.push({
      id: "inbox",
      text: `${pluralize(context.inboxCount, "new inbox item", "new inbox items")} to review.`,
    });
  }

  if (context.tomorrowFirstCommitment) {
    insights.push({
      id: "tomorrow",
      text: `Tomorrow starts with “${context.tomorrowFirstCommitment.title}”.`,
    });
  }

  return insights;
}

export function buildWeeklyInsights(
  context: WeeklyReviewContext,
): ReviewInsight[] {
  const insights: ReviewInsight[] = [];

  if (context.completedLastWeek.length > 0) {
    insights.push({
      id: "completed",
      text: `Last week you completed ${pluralize(context.completedLastWeek.length, "task")}.`,
    });
  }

  if (context.carriedForward.length > 0) {
    insights.push({
      id: "carried-forward",
      text: `${pluralize(context.carriedForward.length, "task")} carried forward from earlier weeks.`,
    });
  }

  if (context.inboxTasks.length > 0) {
    insights.push({
      id: "inbox",
      text: `${pluralize(context.inboxTasks.length, "inbox item")} waiting to be triaged.`,
    });
  }

  if (context.waitingTasks.length > 0) {
    insights.push({
      id: "waiting",
      text: `${pluralize(context.waitingTasks.length, "task")} marked as waiting.`,
    });
  }

  if (context.nextWeekDeadlines.length > 0) {
    insights.push({
      id: "deadlines",
      text: `${pluralize(context.nextWeekDeadlines.length, "deadline")} due next week.`,
    });
  }

  if (context.previousWorkload?.highestPressureDays.length) {
    const days = context.previousWorkload.highestPressureDays.length;
    insights.push({
      id: "pressure",
      text:
        days === 1
          ? "One day last week had more planned work than available capacity."
          : `${days} days last week had more planned work than available capacity.`,
    });
  }

  if (context.nextWorkload?.status === "overloaded") {
    insights.push({
      id: "next-overload",
      text: "Next week may be overloaded based on current estimates.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "clear",
      text: "Your week looks manageable. Confirm priorities and planning.",
    });
  }

  return insights;
}
