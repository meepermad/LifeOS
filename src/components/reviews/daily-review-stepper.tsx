"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  applyReviewDecisionAction,
  completeReviewSessionAction,
  saveDailyPrioritiesAction,
  startReviewSessionAction,
  updateSessionStepAction,
} from "@/lib/actions/reviews";
import { formatAppTimeRange } from "@/lib/dates/timezone";
import {
  buildEveningInsights,
  buildMorningInsights,
} from "@/lib/reviews/insights";
import {
  EVENING_REVIEW_STEPS,
  MORNING_REVIEW_STEPS,
  type EveningReviewContext,
  type MorningReviewContext,
  type ReviewDecisionType,
} from "@/lib/reviews/types";
import { StaleTimerPrompt } from "@/components/timer/stale-timer-prompt";
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

const EVENING_DECISIONS: Array<{
  type: ReviewDecisionType;
  label: string;
  hint: string;
}> = [
  {
    type: "keep_due_date",
    label: "Keep due date",
    hint: "Deadline stays; overdue nag suppressed",
  },
  {
    type: "change_deadline",
    label: "Change deadline",
    hint: "Moves due date to tomorrow",
  },
  {
    type: "schedule_tomorrow",
    label: "Schedule work tomorrow (keep deadline)",
    hint: "Creates a planning proposal; due date unchanged",
  },
  {
    type: "return_to_inbox",
    label: "Return to inbox",
    hint: "Returns task to inbox for re-triage",
  },
  {
    type: "mark_waiting",
    label: "Mark waiting",
    hint: "Sets waiting state; deadline unchanged",
  },
  {
    type: "defer",
    label: "Defer",
    hint: "Hides until tomorrow; deadline unchanged",
  },
  {
    type: "cancel",
    label: "Cancel",
    hint: "Cancels the task",
  },
];

function clampStep(index: number, length: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), length - 1);
}

export function DailyReviewStepper({
  context,
}: {
  context: MorningReviewContext | EveningReviewContext;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const steps =
    context.period === "morning"
      ? MORNING_REVIEW_STEPS
      : EVENING_REVIEW_STEPS;
  const initialStep = clampStep(
    context.session?.current_step ?? 0,
    steps.length,
  );
  const [stepIndex, setStepIndex] = useState(initialStep);
  const [sessionId, setSessionId] = useState<string | null>(
    context.session?.id ?? context.completedSession?.id ?? null,
  );
  const [selectedPriorityIds, setSelectedPriorityIds] = useState<string[]>(
    context.period === "morning"
      ? context.dailyPriorities.map((priority) => priority.task_id)
      : [],
  );
  const [taskDecisions, setTaskDecisions] = useState<
    Record<string, ReviewDecisionType>
  >({});

  const currentStep = steps[stepIndex];
  const isComplete = Boolean(context.completedSession);
  const insights = useMemo(
    () =>
      context.period === "morning"
        ? buildMorningInsights(context)
        : buildEveningInsights(context),
    [context],
  );

  useEffect(() => {
    if (sessionId || isComplete) return;

    startTransition(async () => {
      const reviewType =
        context.period === "morning" ? "morning_daily" : "evening_daily";
      const result = await startReviewSessionAction({
        reviewType,
        reviewDate: context.dateKey,
      });
      if (result.success && result.data) {
        setSessionId(result.data.sessionId);
      } else if (!result.success) {
        setError(result.error);
      }
    });
  }, [context.dateKey, context.period, isComplete, sessionId]);

  useEffect(() => {
    if (!sessionId || isComplete) return;
    startTransition(async () => {
      await updateSessionStepAction({ sessionId, step: stepIndex });
    });
  }, [sessionId, stepIndex, isComplete]);

  function goNext() {
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function goBack() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function togglePriority(taskId: string) {
    setSelectedPriorityIds((current) => {
      if (current.includes(taskId)) {
        return current.filter((id) => id !== taskId);
      }
      if (current.length >= 3) {
        return current;
      }
      return [...current, taskId];
    });
  }

  function handleSavePriorities() {
    if (!sessionId) return;
    startTransition(async () => {
      setError(null);
      const result = await saveDailyPrioritiesAction({
        priorityDate: context.dateKey,
        priorities: selectedPriorityIds.map((taskId, index) => ({
          taskId,
          priorityRank: index + 1,
          priorityLevel: "primary",
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

  function handleRecordDecision(taskId: string, decisionType: ReviewDecisionType) {
    if (!sessionId) return;
    setTaskDecisions((current) => ({ ...current, [taskId]: decisionType }));
    startTransition(async () => {
      setError(null);
      const result = await applyReviewDecisionAction({
        sessionId,
        taskId,
        decisionType,
      });
      if (!result.success) {
        setError(result.error);
      }
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
        <SectionCard title="Review complete">
          <p className="text-sm text-muted">
            You already completed today&apos;s{" "}
            {context.period === "morning" ? "morning" : "evening"} review.
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
            Step {stepIndex + 1} of {steps.length}
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            {currentStep?.label}
          </h2>
        </div>
        <ol className="flex gap-1" aria-label="Review progress">
          {steps.map((step, index) => (
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

      {context.period === "morning" && currentStep?.id === "timer" && (
        <SectionCard title="Active timer">
          {context.staleTimer && context.activeTimer ? (
            <StaleTimerPrompt
              active={context.activeTimer}
              thresholdHours={4}
            />
          ) : context.activeTimer ? (
            <p className="truncate text-sm text-foreground">
              Timer running on &ldquo;
              {context.activeTimer.entry.task_title_snapshot ?? "a task"}&rdquo;.
            </p>
          ) : (
            <EmptyState message="No active timer." />
          )}
        </SectionCard>
      )}

      {context.period === "morning" && currentStep?.id === "overdue" && (
        <SectionCard title="Overdue tasks">
          {context.overdue.length === 0 ? (
            <EmptyState message="No overdue tasks." />
          ) : (
            <ul className="space-y-2">
              {context.overdue.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}/edit`}
                    className="block truncate text-sm text-danger hover:underline"
                  >
                    {task.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {context.period === "morning" && currentStep?.id === "schedule" && (
        <SectionCard title="Today's schedule">
          {context.events.length === 0 ? (
            <EmptyState message="No events scheduled for today." />
          ) : (
            <div className="space-y-2">
              {context.events.map((event) => (
                <EventListItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {context.period === "morning" && currentStep?.id === "priorities" && (
        <SectionCard
          title="Daily priorities"
          description="Choose up to three primary tasks for today."
        >
          {[...context.dueToday, ...context.overdue].length === 0 ? (
            <EmptyState message="No tasks available for priorities." />
          ) : (
            <ul className="space-y-2">
              {[...context.dueToday, ...context.overdue].map((task) => {
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

      {context.period === "morning" && currentStep?.id === "planning" && (
        <PlanningControls periodType="day" planningRun={context.planningRun} />
      )}

      {context.period === "morning" && currentStep?.id === "overload" && (
        <>
          {context.workload ? (
            <WorkloadSummaryCard workload={context.workload} />
          ) : (
            <SectionCard title="Workload">
              <EmptyState message="Workload data unavailable." />
            </SectionCard>
          )}
        </>
      )}

      {context.period === "evening" && currentStep?.id === "completed" && (
        <SectionCard title="Completed today">
          {context.completedToday.length === 0 ? (
            <EmptyState message="No tasks completed today." />
          ) : (
            <ul className="space-y-2">
              {context.completedToday.map((task) => (
                <li
                  key={task.id}
                  className="truncate text-sm text-foreground"
                >
                  {task.title}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {context.period === "evening" && currentStep?.id === "unfinished" && (
        <SectionCard title="Unfinished tasks">
          {context.unfinished.length === 0 ? (
            <EmptyState message="No unfinished tasks from today." />
          ) : (
            <ul className="space-y-4">
              {context.unfinished.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-border px-3 py-3"
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {task.title}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {EVENING_DECISIONS.map((decision) => (
                      <button
                        key={decision.type}
                        type="button"
                        title={decision.hint}
                        onClick={() =>
                          handleRecordDecision(task.id, decision.type)
                        }
                        className={`min-h-10 rounded-lg border px-3 py-2.5 text-xs transition-colors ${
                          taskDecisions[task.id] === decision.type
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-border text-muted hover:border-accent hover:text-foreground"
                        }`}
                      >
                        {decision.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {taskDecisions[task.id]
                      ? EVENING_DECISIONS.find(
                          (decision) =>
                            decision.type === taskDecisions[task.id],
                        )?.hint
                      : "Select an action to apply it and record the decision."}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {context.period === "evening" && currentStep?.id === "feedback" && (
        <SectionCard title="Planning blocks needing feedback">
          {context.awaitingFeedback.length === 0 ? (
            <EmptyState message="No planning blocks need feedback." />
          ) : (
            <ul className="space-y-2">
              {context.awaitingFeedback.map((block) => (
                <li key={block.eventId}>
                  <Link
                    href={`/calendar`}
                    className="block truncate text-sm text-foreground hover:text-accent"
                  >
                    {block.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {formatAppTimeRange(block.startAt, block.endAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {context.period === "evening" && currentStep?.id === "tomorrow" && (
        <SectionCard title="Tomorrow preview">
          {context.tomorrowFirstCommitment ? (
            <div>
              <p className="truncate text-sm font-medium text-foreground">
                First commitment: {context.tomorrowFirstCommitment.title}
              </p>
              <p className="mt-1 text-sm text-muted">
                {context.tomorrowFirstCommitment.all_day
                  ? "All day"
                  : formatAppTimeRange(
                      context.tomorrowFirstCommitment.start_at,
                      context.tomorrowFirstCommitment.end_at,
                    )}
              </p>
            </div>
          ) : (
            <EmptyState message="No commitments scheduled for tomorrow yet." />
          )}
          {context.tomorrowEvents.length > 1 && (
            <ul className="mt-4 space-y-2">
              {context.tomorrowEvents.slice(1, 4).map((event) => (
                <li key={event.id} className="truncate text-sm text-muted">
                  {event.title}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {currentStep?.id === "confirm" && (
        <SectionCard title="Confirm review">
          <p className="text-sm text-muted">
            {context.period === "morning"
              ? "Confirm today's plan and priorities."
              : "Wrap up today's review and decisions."}
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
          {currentStep?.id === "priorities" && context.period === "morning" ? (
            <PrimaryButton loading={isPending} onClick={handleSavePriorities}>
              Save priorities
            </PrimaryButton>
          ) : stepIndex < steps.length - 1 ? (
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
