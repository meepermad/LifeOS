"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  completeReviewSessionAction,
  saveWeeklyPrioritiesAction,
  startReviewSessionAction,
  updateSessionStepAction,
} from "@/lib/actions/reviews";
import { formatAppDate } from "@/lib/dates/timezone";
import { buildWeeklyInsights } from "@/lib/reviews/insights";
import {
  WEEKLY_REVIEW_STEPS,
  type WeeklyReviewContext,
} from "@/lib/reviews/types";
import { PlanningControls } from "@/components/planning/planning-controls";
import { WorkloadSummaryCard } from "@/components/workload/workload-summary-card";
import { ReviewInsightsCard } from "@/components/reviews/review-insights-card";
import {
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
} from "@/components/forms/ui";
import { EventListItem } from "@/components/events/event-list";

function clampStep(index: number, length: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), length - 1);
}

export function WeeklyReviewStepper({
  context,
  weekOffset = 0,
  initialStepIndex,
}: {
  context: WeeklyReviewContext;
  weekOffset?: number;
  initialStepIndex?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(
    clampStep(
      initialStepIndex ?? context.session?.current_step ?? 0,
      WEEKLY_REVIEW_STEPS.length,
    ),
  );
  const [sessionId, setSessionId] = useState<string | null>(
    context.session?.id ?? context.completedSession?.id ?? null,
  );
  const [selectedPriorityIds, setSelectedPriorityIds] = useState<string[]>(
    context.weeklyPriorities.map((priority) => priority.task_id),
  );

  const currentStep = WEEKLY_REVIEW_STEPS[stepIndex];
  const isComplete = Boolean(context.completedSession);
  const insights = useMemo(() => buildWeeklyInsights(context), [context]);

  const candidateTasks = useMemo(() => {
    const ids = new Set<string>();
    const tasks = [
      ...context.nextWeekDeadlines,
      ...context.carriedForward,
      ...context.inboxTasks,
    ];
    return tasks.filter((task) => {
      if (ids.has(task.id)) return false;
      ids.add(task.id);
      return true;
    });
  }, [context]);

  useEffect(() => {
    if (sessionId || isComplete) return;

    startTransition(async () => {
      const result = await startReviewSessionAction({
        reviewType: "weekly",
        reviewWeekStart: context.weekStartDate,
      });
      if (result.success && result.data) {
        setSessionId(result.data.sessionId);
      } else if (!result.success) {
        setError(result.error);
      }
    });
  }, [context.weekStartDate, isComplete, sessionId]);

  useEffect(() => {
    if (!sessionId || isComplete) return;
    startTransition(async () => {
      await updateSessionStepAction({ sessionId, step: stepIndex });
    });
  }, [sessionId, stepIndex, isComplete]);

  function goNext() {
    setStepIndex((index) =>
      Math.min(index + 1, WEEKLY_REVIEW_STEPS.length - 1),
    );
  }

  function goBack() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function togglePriority(taskId: string) {
    setSelectedPriorityIds((current) => {
      if (current.includes(taskId)) {
        return current.filter((id) => id !== taskId);
      }
      if (current.length >= 5) {
        return current;
      }
      return [...current, taskId];
    });
  }

  function handleSavePriorities() {
    startTransition(async () => {
      setError(null);
      const result = await saveWeeklyPrioritiesAction({
        weekStartDate: context.weekStartDate,
        priorities: selectedPriorityIds.map((taskId, index) => ({
          taskId,
          priorityRank: index + 1,
        })),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      goNext();
      router.refresh();
    });
  }

  function handleComplete() {
    if (!sessionId) return;
    startTransition(async () => {
      setError(null);
      const result = await completeReviewSessionAction({
        sessionId,
        summary: { insights: insights.map((item) => item.text) },
      });
      if (result.success) {
        router.push("/today");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (isComplete) {
    return (
      <div className="space-y-6">
        <ReviewInsightsCard insights={insights} />
        <SectionCard title="Weekly review complete">
          <p className="text-sm text-muted">
            You already completed the weekly review for the week of{" "}
            {formatAppDate(context.weekStartDate, "MMM d")}.
          </p>
          <Link
            href="/today"
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            Back to Today
          </Link>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            Step {stepIndex + 1} of {WEEKLY_REVIEW_STEPS.length}
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            {currentStep?.label}
          </h2>
        </div>
        <ol className="flex gap-1" aria-label="Review progress">
          {WEEKLY_REVIEW_STEPS.map((step, index) => (
            <li key={step.id}>
              <span
                className={`block h-2 w-2 rounded-full ${
                  index <= stepIndex ? "bg-accent" : "bg-border"
                }`}
                aria-current={index === stepIndex ? "step" : undefined}
                aria-label={`${step.label}${index === stepIndex ? ", current" : ""}`}
              />
            </li>
          ))}
        </ol>
      </div>

      {currentStep?.id === "confirm" && (
        <ReviewInsightsCard insights={insights} />
      )}

      {currentStep?.id === "timing" && (
        <SectionCard title="Timing data">
          <p className="text-sm text-muted">
            Review time entries and estimates in Insights if actual time looks
            incomplete.
          </p>
          <Link
            href="/insights"
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            Open Insights
          </Link>
        </SectionCard>
      )}

      {currentStep?.id === "unfinished" && (
        <SectionCard title="Unfinished work">
          {context.carriedForward.length === 0 ? (
            <EmptyState message="No carried-forward tasks." />
          ) : (
            <ul className="space-y-2">
              {context.carriedForward.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}/edit`}
                    className="block truncate text-sm text-foreground hover:text-accent"
                  >
                    {task.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {context.completedLastWeek.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              Completed last week: {context.completedLastWeek.length} tasks
            </p>
          )}
        </SectionCard>
      )}

      {currentStep?.id === "inbox" && (
        <SectionCard title="Inbox">
          {context.inboxTasks.length === 0 ? (
            <EmptyState message="Your inbox is clear." />
          ) : (
            <ul className="space-y-2">
              {context.inboxTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}/edit`}
                    className="block truncate text-sm text-foreground hover:text-accent"
                  >
                    {task.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {currentStep?.id === "waiting" && (
        <SectionCard title="Waiting items">
          {context.waitingTasks.length === 0 ? (
            <EmptyState message="No tasks marked as waiting." />
          ) : (
            <ul className="space-y-2">
              {context.waitingTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}/edit`}
                    className="block truncate text-sm text-foreground hover:text-accent"
                  >
                    {task.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {currentStep?.id === "work" && (
        <SectionCard title="Work schedule">
          {context.nextWeekEvents.filter((e) => e.event_type === "work")
            .length === 0 ? (
            <EmptyState message="No work shifts found for next week." />
          ) : (
            <div className="space-y-2">
              {context.nextWeekEvents
                .filter((event) => event.event_type === "work")
                .map((event) => (
                  <EventListItem key={event.id} event={event} />
                ))}
            </div>
          )}
          <Link
            href="/work"
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            Open work schedule
          </Link>
        </SectionCard>
      )}

      {currentStep?.id === "school" && (
        <SectionCard title="School schedule">
          {context.nextWeekEvents.filter((e) => e.event_type === "class")
            .length === 0 ? (
            <EmptyState message="No classes found for next week." />
          ) : (
            <div className="space-y-2">
              {context.nextWeekEvents
                .filter((event) => event.event_type === "class")
                .map((event) => (
                  <EventListItem key={event.id} event={event} />
                ))}
            </div>
          )}
          <Link
            href="/school"
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            Open school setup
          </Link>
        </SectionCard>
      )}

      {currentStep?.id === "deadlines" && (
        <SectionCard title="Next week's deadlines">
          {context.nextWeekDeadlines.length === 0 ? (
            <EmptyState message="No deadlines due next week." />
          ) : (
            <ul className="space-y-2">
              {context.nextWeekDeadlines.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}/edit`}
                    className="block truncate text-sm text-foreground hover:text-accent"
                  >
                    {task.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {currentStep?.id === "priorities" && (
        <SectionCard
          title="Weekly priorities"
          description="Choose up to five priorities for the coming week."
        >
          {candidateTasks.length === 0 ? (
            <EmptyState message="No tasks available for weekly priorities." />
          ) : (
            <ul className="space-y-2">
              {candidateTasks.map((task) => {
                const selected = selectedPriorityIds.includes(task.id);
                return (
                  <li key={task.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-accent">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => togglePriority(task.id)}
                        className="h-4 w-4 shrink-0 rounded border-border text-accent"
                      />
                      <span className="truncate text-sm text-foreground">
                        {task.title}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      )}

      {currentStep?.id === "planning" && (
        <>
          {context.nextWorkload && (
            <WorkloadSummaryCard workload={context.nextWorkload} />
          )}
          <PlanningControls
            periodType="week"
            weekOffset={weekOffset + 1}
            planningRun={context.nextPlanningRun}
          />
        </>
      )}

      {currentStep?.id === "confirm" && (
        <SectionCard title="Confirm weekly review">
          <p className="text-sm text-muted">
            Week of {formatAppDate(context.weekStartDate, "MMMM d")} — confirm
            priorities and planning for the week ahead.
          </p>
        </SectionCard>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-md lg:bottom-0 lg:left-56">
        <div className="mx-auto flex max-w-lg gap-3 lg:max-w-6xl">
          {stepIndex > 0 && (
            <SecondaryButton disabled={isPending} onClick={goBack}>
              Back
            </SecondaryButton>
          )}
          {currentStep?.id === "priorities" ? (
            <PrimaryButton loading={isPending} onClick={handleSavePriorities}>
              Save priorities
            </PrimaryButton>
          ) : stepIndex < WEEKLY_REVIEW_STEPS.length - 1 ? (
            <PrimaryButton disabled={isPending} onClick={goNext}>
              Continue
            </PrimaryButton>
          ) : (
            <PrimaryButton loading={isPending} onClick={handleComplete}>
              Complete review
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
