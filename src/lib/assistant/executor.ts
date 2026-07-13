import {
  buildScheduleSummary,
  formatAcademicPeriodResponse,
  formatClassesResponse,
  formatDueItemsResponse,
  formatNextClassResponse,
} from "@/lib/assistant/schedule-summary";
import { deduplicateScheduleEvents } from "@/lib/assistant/schedule-dedup";
import { buildFinalsWeekSummary } from "@/lib/academic/finals-summary";
import { resolveAcademicPeriodRange } from "@/lib/academic/resolve-period";
import { listActiveSuppressedCanvasUids, listActiveSuppressedCanvasUidsForUser } from "@/lib/data/academic/canvas-links";
import { listCoursesForTerm } from "@/lib/data/academic/courses";
import { listAcademicTerms } from "@/lib/data/academic/terms";
import { listMeetingsForTerm } from "@/lib/data/academic/meetings";
import { listEventsInRangeForUser, listTasksForUser, listAcademicTermsForUser, listMeetingsForTermForUser, listCoursesForTermForUser } from "@/lib/data/events-for-user";
import { suggestIntentsForUnknown } from "@/lib/assistant/paraphrase";
import { extractRecognizedDatePhrase } from "@/lib/assistant/academic-parser";
import type { DateRangeRef } from "@/lib/assistant/intents";
import {
  addAppDays,
  getAppLocalDateKey,
  getDayBoundsInUtc,
  getTodayBoundsUtc,
  getWeekBounds,
  nowInAppTimezone,
  toUtcEndOfAppLocalDay,
  toUtcFromAppLocal,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import { findAvailabilitySlots } from "@/lib/assistant/availability-finder";
import { matchTasks } from "@/lib/assistant/entity-matcher";
import type { ParsedCommand } from "@/lib/assistant/intents";
import {
  formatActionResult,
  formatAgendaResponse,
  formatAvailabilityResponse,
  formatCompleteTaskPreview,
  formatError,
  formatEventPreview,
  formatPlanGeneratedResponse,
  formatProposalActionPreview,
  formatTaskMatchClarification,
  formatTaskPreview,
  formatUnknownResponse,
  formatWorkloadResponse,
  HELP_TEXT,
} from "@/lib/assistant/responses";
import { getManualCalendar } from "@/lib/data/calendars";
import {
  assertNoBlockingOverlap,
  createEvent,
  listEventsInRange,
} from "@/lib/data/events";
import {
  generateAndStorePlanningRun,
  getActivePlanningRun,
  acceptProposal,
  rejectProposal,
  rejectAllPendingProposals,
  loadPlanningInputs,
} from "@/lib/data/planning";
import { createTask, listTasks, setTaskCompletion } from "@/lib/data/tasks";
import { getCachedWorkload } from "@/lib/data/workload";
import { getProfile } from "@/lib/data/bootstrap";
import { validateProposalForAcceptance } from "@/lib/planning/proposal-validation";
import { toPlanningEvent, toPlanningTask } from "@/lib/planning/mappers";
import { getLifeOSPlanningCalendar } from "@/lib/data/calendars";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { createClient } from "@/lib/supabase/server";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import {
  executeWorkCommand,
  getWorkHoursResponse,
  getWorkScheduleResponse,
  previewWorkCommand,
} from "@/lib/work/assistant-commands";
import {
  buildTimerWritePreview,
  executeTimerReadOnly,
  executeTimerWrite,
} from "@/lib/assistant/timer-executor";
import {
  executePauseRecurringTask,
  executeSkipRecurrenceOccurrence,
  getAwaitingFeedbackSummary,
  getHelpPlanTodaySummary,
  getInboxSummary,
  getPendingDecisionsSummary,
  getRecurringTasksSummary,
  getUnscheduledShelfSummary,
  previewUnfinishedRollover,
  recordKeepOverdueDecision,
  resolveRecurrenceTemplate,
  resolveTaskForUser,
} from "@/lib/assistant/workflow-commands";
import { createInboxTask, deferTask, markWaiting } from "@/lib/data/inbox";
import { createRecurrenceTemplate } from "@/lib/data/recurrence";
import {
  spokenForAwaitingFeedback,
  spokenForInboxCount,
  spokenForPendingDecisions,
  spokenForRecurringCount,
  spokenForUnscheduledShelf,
} from "@/lib/shortcuts/spoken";
import { WRITE_INTENTS, READ_ONLY_INTENTS } from "@/lib/assistant/intents";
import type { EventType } from "@/types/domain";
import type { Json } from "@/types/database.types";

export type ExecutorResponse = {
  content: string;
  messageType: "text" | "clarification" | "action_preview" | "action_result" | "error";
  structuredPayload: Record<string, unknown>;
  actionPreview?: {
    actionType: string;
    proposedPayload: Record<string, unknown>;
  };
  clarification?: {
    partial: Record<string, unknown>;
    missingField: string;
    prompt: string;
  };
};

async function resolveRangeBounds(
  range: DateRangeRef,
): Promise<{ start: Date; end: Date; label: string }> {
  return {
    start: toUtcFromAppLocalDate(range.startDateKey),
    end: toUtcEndOfAppLocalDay(range.endDateKey),
    label: range.label,
  };
}

async function resolveAgendaBoundsAsync(
  command: Extract<ParsedCommand, { intent: "show_agenda" }>,
): Promise<{ start: Date; end: Date; label: string }> {
  const now = nowInAppTimezone();

  if (command.scope === "today") {
    const bounds = getTodayBoundsUtc(now);
    return { ...bounds, label: "today" };
  }

  if (command.scope === "tomorrow") {
    const tomorrowKey = addAppDays(getAppLocalDateKey(now), 1);
    const bounds = getDayBoundsInUtc(tomorrowKey);
    return { ...bounds, label: "tomorrow" };
  }

  if (command.scope === "week") {
    const profile = await getProfile();
    const { start, end } = getWeekBounds(
      now,
      profile.week_starts_on as 0 | 1,
      0,
    );
    return { start, end, label: "this week" };
  }

  if (command.scope === "range" && command.range) {
    return resolveRangeBounds(command.range);
  }

  const dateKey = command.dateKey ?? getAppLocalDateKey(now);
  const bounds = getDayBoundsInUtc(dateKey);
  return { ...bounds, label: dateKey };
}

export type ExecuteReadOnlyOptions = {
  userId?: string;
};

async function listEventsForReadOnly(
  userId: string | undefined,
  start: string,
  end: string,
) {
  if (userId) {
    return listEventsInRangeForUser(userId, start, end);
  }
  return listEventsInRange(start, end);
}

async function listTasksForReadOnly(userId?: string) {
  if (userId) {
    return listTasksForUser(userId, { status: "active" });
  }
  return listTasks({ status: "active" });
}

async function loadScheduleDedupContext(userId?: string) {
  const [suppressedCanvasUids, terms] = await Promise.all([
    userId
      ? listActiveSuppressedCanvasUidsForUser(userId)
      : listActiveSuppressedCanvasUids(),
    userId ? listAcademicTermsForUser(userId) : listAcademicTerms(),
  ]);

  const archivedMeetingIds = new Set<string>();
  for (const term of terms.filter((entry) => entry.status === "archived")) {
    const meetings = userId
      ? await listMeetingsForTermForUser(userId, term.id)
      : await listMeetingsForTerm(term.id);
    for (const meeting of meetings) {
      archivedMeetingIds.add(meeting.id);
    }
  }

  return { suppressedCanvasUids, archivedMeetingIds };
}

async function resolveWorkloadSummary(
  command: Extract<ParsedCommand, { intent: "show_workload" }>,
) {
  if (command.scope === "range" && command.range) {
    return getCachedWorkload({
      periodType: "week",
      startDateKey: command.range.startDateKey,
      endDateKey: command.range.endDateKey,
    });
  }
  if (command.scope === "week") {
    return getCachedWorkload({ periodType: "week" });
  }
  return getCachedWorkload({ periodType: "day" });
}

async function resolveProposalIds(
  command: Extract<
    ParsedCommand,
    { intent: "accept_proposals" | "reject_proposals" }
  >,
): Promise<{ proposalIds: string[]; periodLabel: string; totalMinutes: number }> {
  const periodType = command.periodType ?? "day";
  const run = await getActivePlanningRun({
    periodType,
    weekOffset: command.weekOffset,
  });

  if (!run) {
    return { proposalIds: [], periodLabel: periodType === "week" ? "this week" : "today", totalMinutes: 0 };
  }

  const pending = run.proposals.filter((p) => p.status === "pending");

  if (command.mode === "all" || command.mode === "period_all") {
    return {
      proposalIds: pending.map((p) => p.id),
      periodLabel: periodType === "week" ? "this week" : "today",
      totalMinutes: pending.reduce((sum, p) => sum + p.proposed_minutes, 0),
    };
  }

  if (command.mode === "index" && command.indices) {
    const ids = command.indices
      .map((index) => pending[index - 1]?.id)
      .filter((id): id is string => Boolean(id));
    const selected = command.indices
      .map((index) => pending[index - 1])
      .filter(Boolean);
    return {
      proposalIds: ids,
      periodLabel: periodType === "week" ? "this week" : "today",
      totalMinutes: selected.reduce((sum, p) => sum + (p?.proposed_minutes ?? 0), 0),
    };
  }

  return { proposalIds: [], periodLabel: "today", totalMinutes: 0 };
}

async function resolveTaskForWrite(
  command: Extract<
    ParsedCommand,
    { intent: "defer_task" | "mark_waiting" | "keep_task_overdue" }
  >,
): Promise<
  | { task: { id: string; title: string } }
  | { error: ExecutorResponse }
> {
  if (command.taskId) {
    return {
      task: { id: command.taskId, title: command.taskTitle ?? "task" },
    };
  }

  const match = await resolveTaskForUser(command.taskTitle ?? "");
  if (match.kind === "none") {
    const err = formatError("I couldn't find an active task matching that title.");
    return {
      error: {
        content: err.content,
        messageType: "error",
        structuredPayload: err.payload,
      },
    };
  }

  if (match.kind === "multiple") {
    const formatted = formatTaskMatchClarification(
      match.tasks.map((t) => ({ id: t.id, title: t.title })),
    );
    return {
      error: {
        content: formatted.content,
        messageType: "clarification",
        structuredPayload: formatted.payload,
        clarification: {
          partial: {
            intent: command.intent,
            candidates: match.tasks.map((t) => ({
              id: t.id,
              title: t.title,
            })),
          },
          missingField: "taskMatch",
          prompt: formatted.content,
        },
      },
    };
  }

  return { task: { id: match.task.id, title: match.task.title } };
}

export async function executeReadOnly(
  command: ParsedCommand,
  options: ExecuteReadOnlyOptions = {},
): Promise<ExecutorResponse> {
  const { userId } = options;
  switch (command.intent) {
    case "help":
      return {
        content: HELP_TEXT,
        messageType: "text",
        structuredPayload: {},
      };

    case "unknown": {
      const phrase = extractRecognizedDatePhrase(command.raw);
      const suggestions = suggestIntentsForUnknown(command.raw);
      return {
        content: formatUnknownResponse(command.raw, suggestions, phrase),
        messageType: "text",
        structuredPayload: { suggestions, recognizedPhrase: phrase },
      };
    }

    case "schedule_summary": {
      const bounds = await resolveRangeBounds(command.range);
      const rawEvents = await listEventsForReadOnly(
        userId,
        bounds.start.toISOString(),
        bounds.end.toISOString(),
      );
      const dedupContext = await loadScheduleDedupContext(userId);
      const events = deduplicateScheduleEvents({
        events: rawEvents,
        suppressedCanvasUids: dedupContext.suppressedCanvasUids,
        archivedMeetingIds: dedupContext.archivedMeetingIds,
      });
      const tasks = await listTasksForReadOnly(userId);
      const rangeTasks = tasks.filter((task) => {
        if (!task.due_at) return false;
        const dueKey = task.due_at.slice(0, 10);
        return (
          dueKey >= command.range.startDateKey &&
          dueKey <= command.range.endDateKey
        );
      });
      const workload =
        command.range.phrase === "next week" ||
        command.range.phrase === "this week" ||
        command.range.phrase === "week after next"
          ? await getCachedWorkload({
              periodType: "week",
              startDateKey: command.range.startDateKey,
              endDateKey: command.range.endDateKey,
            })
          : await getCachedWorkload({
              periodType: "week",
              startDateKey: command.range.startDateKey,
              endDateKey: command.range.endDateKey,
            });
      const formatted = buildScheduleSummary({
        label: bounds.label,
        events,
        tasks: rangeTasks,
        workload,
        startDateKey: command.range.startDateKey,
        endDateKey: command.range.endDateKey,
      });
      return {
        content: formatted.content,
        messageType: "text",
        structuredPayload: formatted.payload,
      };
    }

    case "show_next_class": {
      const now = new Date();
      const rawEvents = await listEventsForReadOnly(
        userId,
        now.toISOString(),
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      );
      const dedupContext = await loadScheduleDedupContext(userId);
      const events = deduplicateScheduleEvents({
        events: rawEvents,
        suppressedCanvasUids: dedupContext.suppressedCanvasUids,
        archivedMeetingIds: dedupContext.archivedMeetingIds,
      });
      const nextClass = events
        .filter(
          (event) =>
            event.event_type === "class" &&
            event.status !== "cancelled" &&
            new Date(event.start_at) > now,
        )
        .sort((a, b) => a.start_at.localeCompare(b.start_at))[0] ?? null;
      return {
        content: formatNextClassResponse(nextClass),
        messageType: "text",
        structuredPayload: { eventId: nextClass?.id ?? null },
      };
    }

    case "show_classes": {
      const bounds = await resolveRangeBounds(command.range);
      const rawEvents = await listEventsForReadOnly(
        userId,
        bounds.start.toISOString(),
        bounds.end.toISOString(),
      );
      const dedupContext = await loadScheduleDedupContext(userId);
      const events = deduplicateScheduleEvents({
        events: rawEvents,
        suppressedCanvasUids: dedupContext.suppressedCanvasUids,
        archivedMeetingIds: dedupContext.archivedMeetingIds,
      });
      return {
        content: formatClassesResponse({
          label: bounds.label,
          events,
        }),
        messageType: "text",
        structuredPayload: {},
      };
    }

    case "query_academic_period": {
      const resolved =
        command.range.startDateKey === "1970-01-01"
          ? await resolveAcademicPeriodRange(command.periodKind)
          : command.range;
      if (!resolved) {
        return {
          content: `I could not find ${command.periodKind} on your academic calendar. Set up a term in School settings.`,
          messageType: "text",
          structuredPayload: {},
        };
      }

      if (/\bfinals week\b/i.test(command.periodKind)) {
        const terms = userId
          ? await listAcademicTermsForUser(userId)
          : await listAcademicTerms();
        const activeTerm =
          terms.find((term) => term.status === "active") ?? terms[0];
        const courses = activeTerm
          ? userId
            ? await listCoursesForTermForUser(userId, activeTerm.id)
            : await listCoursesForTerm(activeTerm.id)
          : [];
        const rawEvents = await listEventsForReadOnly(
          userId,
          `${resolved.startDateKey}T00:00:00.000Z`,
          `${resolved.endDateKey}T23:59:59.999Z`,
        );
        const tasks = await listTasksForReadOnly(userId);
        return {
          content: buildFinalsWeekSummary({
            label: resolved.label,
            startDateKey: resolved.startDateKey,
            endDateKey: resolved.endDateKey,
            courses,
            events: rawEvents,
            tasks,
          }),
          messageType: "text",
          structuredPayload: { periodKind: command.periodKind },
        };
      }

      return {
        content: formatAcademicPeriodResponse({
          label: resolved.label,
          startDateKey: resolved.startDateKey,
          endDateKey: resolved.endDateKey,
        }),
        messageType: "text",
        structuredPayload: { periodKind: command.periodKind },
      };
    }

    case "show_due_items": {
      const bounds = await resolveRangeBounds(command.range);
      const events = await listEventsInRange(
        bounds.start.toISOString(),
        bounds.end.toISOString(),
      );
      const deadlineEvents = events.filter((e) => e.event_type === "deadline");
      const tasks = await listTasksForReadOnly(userId);
      const rangeTasks = tasks.filter((task) => {
        if (!task.due_at) return false;
        const dueKey = task.due_at.slice(0, 10);
        return (
          dueKey >= command.range.startDateKey &&
          dueKey <= command.range.endDateKey
        );
      });
      return {
        content: formatDueItemsResponse({
          label: bounds.label,
          tasks: rangeTasks,
          deadlineEvents,
        }),
        messageType: "text",
        structuredPayload: {},
      };
    }

    case "show_agenda": {
      const bounds = await resolveAgendaBoundsAsync(command);
      const events = await listEventsInRange(
        bounds.start.toISOString(),
        bounds.end.toISOString(),
      );
      const formatted = formatAgendaResponse({
        scope: bounds.label,
        events,
      });
      return {
        content: formatted.content,
        messageType: "text",
        structuredPayload: formatted.payload,
      };
    }

    case "show_workload": {
      const summary = await resolveWorkloadSummary(command);
      const scope =
        command.scope === "range" && command.range
          ? command.range.label
          : command.scope === "week"
            ? "this week"
            : command.dateKey ?? command.scope;
      const formatted = formatWorkloadResponse(summary, scope);
      return {
        content: formatted.content,
        messageType: "text",
        structuredPayload: formatted.payload,
      };
    }

    case "find_availability": {
      const now = nowInAppTimezone();
      const todayKey = getAppLocalDateKey(now);
      const startDateKey = command.startDateKey ?? todayKey;
      const endDateKey =
        command.beforeDateKey ??
        command.endDateKey ??
        addAppDays(startDateKey, 6);

      const planningInput = await loadPlanningInputs({ periodType: "week" });
      const slots = findAvailabilitySlots({
        durationMinutes: command.durationMinutes,
        startDateKey,
        endDateKey,
        beforeDateKey: command.beforeDateKey,
        timeOfDay: command.timeOfDay,
        planningInput,
      });

      const formatted = formatAvailabilityResponse(
        slots,
        command.durationMinutes,
      );
      return {
        content: formatted.content,
        messageType: "text",
        structuredPayload: formatted.payload,
      };
    }

    case "generate_plan": {
      const result = await generateAndStorePlanningRun({
        periodType: command.periodType,
        weekOffset: command.weekOffset,
      });
      const formatted = formatPlanGeneratedResponse(result);
      return {
        content: formatted.content,
        messageType: "text",
        structuredPayload: formatted.payload,
      };
    }

    case "show_work_schedule": {
      const content = await getWorkScheduleResponse(command);
      return {
        content,
        messageType: "text",
        structuredPayload: { link: "/work" },
      };
    }

    case "show_work_hours": {
      const content = await getWorkHoursResponse(command);
      return {
        content,
        messageType: "text",
        structuredPayload: { link: "/work" },
      };
    }

    case "show_inbox": {
      const summary = await getInboxSummary(userId);
      const spoken = spokenForInboxCount(summary.count);
      return {
        content: spoken.displayText,
        messageType: "text",
        structuredPayload: { ...summary, spokenText: spoken.spokenText },
      };
    }

    case "start_morning_review":
      return {
        content: "Opening your morning review.",
        messageType: "text",
        structuredPayload: { link: "/review/daily" },
      };

    case "start_weekly_review":
      return {
        content: "Opening your weekly review.",
        messageType: "text",
        structuredPayload: { link: "/review/weekly" },
      };

    case "help_plan_today": {
      const summary = await getHelpPlanTodaySummary();
      const content = [
        `Today (${summary.dateKey}): ${summary.eventCount} scheduled event${summary.eventCount === 1 ? "" : "s"}.`,
        `Workload is ${summary.workloadStatus.replace(/_/g, " ")}.`,
        summary.inboxCount > 0
          ? `${summary.inboxCount} inbox capture${summary.inboxCount === 1 ? "" : "s"} waiting to triage.`
          : "Inbox is clear.",
        "Open Today to generate or accept planning proposals.",
      ].join("\n");
      return {
        content,
        messageType: "text",
        structuredPayload: { ...summary },
      };
    }

    case "show_pending_decisions": {
      const summary = await getPendingDecisionsSummary(userId);
      const spoken = spokenForPendingDecisions(summary);
      return {
        content: spoken.displayText,
        messageType: "text",
        structuredPayload: { ...summary, spokenText: spoken.spokenText },
      };
    }

    case "show_awaiting_feedback": {
      const summary = await getAwaitingFeedbackSummary(userId);
      const spoken = spokenForAwaitingFeedback(summary.count);
      return {
        content: spoken.displayText,
        messageType: "text",
        structuredPayload: { ...summary, spokenText: spoken.spokenText },
      };
    }

    case "show_recurring_tasks": {
      const summary = await getRecurringTasksSummary();
      const spoken = spokenForRecurringCount(summary.count);
      const lines = [
        spoken.displayText,
        ...(summary.templates.length > 0
          ? ["", "Active templates:", ...summary.templates.map((t) => `• ${t}`)]
          : []),
      ];
      return {
        content: lines.join("\n"),
        messageType: "text",
        structuredPayload: { ...summary, spokenText: spoken.spokenText },
      };
    }

    case "find_time_unscheduled": {
      const summary = await getUnscheduledShelfSummary();
      const spoken = spokenForUnscheduledShelf(summary.count);
      return {
        content: spoken.displayText,
        messageType: "text",
        structuredPayload: { ...summary, spokenText: spoken.spokenText },
      };
    }

    default: {
      const timerResult = await executeTimerReadOnly(command);
      if (timerResult) return timerResult;
      throw new Error(`Intent ${(command as ParsedCommand).intent} is not read-only`);
    }
  }
}

export async function buildWritePreview(
  command: ParsedCommand,
): Promise<ExecutorResponse> {
  switch (command.intent) {
    case "create_event": {
      const formatted = formatEventPreview(command);
      return {
        content: formatted.content,
        messageType: "action_preview",
        structuredPayload: formatted.payload,
        actionPreview: {
          actionType: "create_event",
          proposedPayload: { command },
        },
      };
    }

    case "create_task": {
      const formatted = formatTaskPreview(command);
      return {
        content: formatted.content,
        messageType: "action_preview",
        structuredPayload: formatted.payload,
        actionPreview: {
          actionType: "create_task",
          proposedPayload: { command },
        },
      };
    }

    case "complete_task": {
      if (command.taskId) {
        const formatted = formatCompleteTaskPreview({
          taskTitle: command.taskTitle ?? "task",
        });
        return {
          content: formatted.content,
          messageType: "action_preview",
          structuredPayload: formatted.payload,
          actionPreview: {
            actionType: "complete_task",
            proposedPayload: { command },
          },
        };
      }

      const tasks = await listTasks({ status: "active" });
      const match = matchTasks(command.taskTitle ?? "", tasks);

      if (match.kind === "none") {
        const err = formatError("I couldn't find an active task matching that title.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }

      if (match.kind === "multiple") {
        const formatted = formatTaskMatchClarification(
          match.tasks.map((t) => ({ id: t.id, title: t.title })),
        );
        return {
          content: formatted.content,
          messageType: "clarification",
          structuredPayload: formatted.payload,
          clarification: {
            partial: {
              intent: "complete_task",
              candidates: match.tasks.map((t) => ({
                id: t.id,
                title: t.title,
              })),
            },
            missingField: "taskMatch",
            prompt: formatted.content,
          },
        };
      }

      const task = match.task;
      const formatted = formatCompleteTaskPreview({ taskTitle: task.title });
      return {
        content: formatted.content,
        messageType: "action_preview",
        structuredPayload: formatted.payload,
        actionPreview: {
          actionType: "complete_task",
          proposedPayload: {
            command: {
              intent: "complete_task",
              taskId: task.id,
              taskTitle: task.title,
            },
          },
        },
      };
    }

    case "accept_proposals": {
      const resolved = await resolveProposalIds(command);
      if (resolved.proposalIds.length === 0) {
        const err = formatError("No pending proposals found to accept.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      const formatted = formatProposalActionPreview({
        action: "accept",
        count: resolved.proposalIds.length,
        totalMinutes: resolved.totalMinutes,
        periodLabel: resolved.periodLabel,
      });
      return {
        content: formatted.content,
        messageType: "action_preview",
        structuredPayload: formatted.payload,
        actionPreview: {
          actionType: "accept_proposals",
          proposedPayload: {
            command,
            proposalIds: resolved.proposalIds,
          },
        },
      };
    }

    case "reject_proposals": {
      if (command.mode === "all") {
        const run = await getActivePlanningRun({ periodType: "day" });
        if (!run) {
          const err = formatError("No active planning run with pending proposals.");
          return {
            content: err.content,
            messageType: "error",
            structuredPayload: err.payload,
          };
        }
        const pending = run.proposals.filter((p) => p.status === "pending");
        const formatted = formatProposalActionPreview({
          action: "reject",
          count: pending.length,
        });
        return {
          content: formatted.content,
          messageType: "action_preview",
          structuredPayload: formatted.payload,
          actionPreview: {
            actionType: "reject_proposals",
            proposedPayload: {
              command: { ...command, runId: run.run.id },
              proposalIds: pending.map((p) => p.id),
            },
          },
        };
      }

      const resolved = await resolveProposalIds(command);
      const formatted = formatProposalActionPreview({
        action: "reject",
        count: resolved.proposalIds.length,
      });
      return {
        content: formatted.content,
        messageType: "action_preview",
        structuredPayload: formatted.payload,
        actionPreview: {
          actionType: "reject_proposals",
          proposedPayload: {
            command,
            proposalIds: resolved.proposalIds,
          },
        },
      };
    }

    case "regenerate_plan": {
      const formatted = formatProposalActionPreview({
        action: "regenerate",
        count: 0,
        periodLabel: command.periodType === "week" ? "this week" : "today",
      });
      return {
        content: formatted.content,
        messageType: "action_preview",
        structuredPayload: formatted.payload,
        actionPreview: {
          actionType: "regenerate_plan",
          proposedPayload: { command },
        },
      };
    }

    case "clear_chat": {
      const formatted = formatProposalActionPreview({
        action: "clear",
        count: 0,
      });
      return {
        content: formatted.content,
        messageType: "action_preview",
        structuredPayload: formatted.payload,
        actionPreview: {
          actionType: "clear_chat",
          proposedPayload: { command },
        },
      };
    }

    case "set_work_schedule":
    case "add_work_shift":
    case "update_work_shift":
    case "delete_work_shift":
    case "copy_work_schedule": {
      const preview = await previewWorkCommand(command);
      return {
        content: preview.content,
        messageType: "action_preview",
        structuredPayload: { link: "/work" },
        actionPreview: {
          actionType: command.intent,
          proposedPayload: { command, source: "assistant" },
        },
      };
    }

    case "create_inbox_task": {
      const content = `Add "${command.title}" to your inbox for triage.`;
      return {
        content,
        messageType: "action_preview",
        structuredPayload: { link: "/inbox" },
        actionPreview: {
          actionType: "create_inbox_task",
          proposedPayload: { command },
        },
      };
    }

    case "defer_task": {
      const resolved = await resolveTaskForWrite(command);
      if ("error" in resolved) return resolved.error;
      const task = resolved.task;
      const content = `Defer "${task.title}" until ${command.untilDateKey}.`;
      return {
        content,
        messageType: "action_preview",
        structuredPayload: { link: "/tasks" },
        actionPreview: {
          actionType: "defer_task",
          proposedPayload: {
            command: { ...command, taskId: task.id, taskTitle: task.title },
          },
        },
      };
    }

    case "mark_waiting": {
      const resolved = await resolveTaskForWrite(command);
      if ("error" in resolved) return resolved.error;
      const task = resolved.task;
      const content = `Mark "${task.title}" as waiting (${command.reason}).`;
      return {
        content,
        messageType: "action_preview",
        structuredPayload: { link: "/tasks" },
        actionPreview: {
          actionType: "mark_waiting",
          proposedPayload: {
            command: { ...command, taskId: task.id, taskTitle: task.title },
          },
        },
      };
    }

    case "create_recurring_task": {
      const content = `Create recurring task "${command.title}".`;
      return {
        content,
        messageType: "action_preview",
        structuredPayload: { link: "/tasks/recurring" },
        actionPreview: {
          actionType: "create_recurring_task",
          proposedPayload: { command },
        },
      };
    }

    case "pause_recurring_task": {
      const template = await resolveRecurrenceTemplate(command.templateTitle);
      if (!template) {
        const err = formatError("I couldn't find a matching recurring template.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      const content = `Pause recurring task "${template.title}".`;
      return {
        content,
        messageType: "action_preview",
        structuredPayload: { link: "/tasks/recurring" },
        actionPreview: {
          actionType: "pause_recurring_task",
          proposedPayload: {
            command: {
              ...command,
              templateId: template.id,
              templateTitle: template.title,
            },
          },
        },
      };
    }

    case "skip_recurrence_occurrence": {
      const template = await resolveRecurrenceTemplate(command.templateTitle);
      if (!template) {
        const err = formatError("I couldn't find a matching recurring template.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      const content = `Skip the ${command.occurrenceDate} occurrence of "${template.title}".`;
      return {
        content,
        messageType: "action_preview",
        structuredPayload: { link: "/tasks/recurring" },
        actionPreview: {
          actionType: "skip_recurrence_occurrence",
          proposedPayload: {
            command: {
              ...command,
              templateId: template.id,
              templateTitle: template.title,
            },
          },
        },
      };
    }

    case "preview_rollover": {
      const preview = await previewUnfinishedRollover(command.targetDateKey);
      const lines = [
        `Rollover preview for ${preview.sourceDateKey}: ${preview.previews.length} task${preview.previews.length === 1 ? "" : "s"} with unscheduled work.`,
        ...preview.previews.map(
          (item) =>
            `• ${item.title}: ${item.remainingMinutes ?? "?"} min → ${item.suggestedDateKey}`,
        ),
      ];
      return {
        content: lines.join("\n"),
        messageType: "action_preview",
        structuredPayload: { preview },
        actionPreview: {
          actionType: "preview_rollover",
          proposedPayload: { command, preview },
        },
      };
    }

    case "keep_task_overdue": {
      const resolved = await resolveTaskForWrite(command);
      if ("error" in resolved) return resolved.error;
      const task = resolved.task;
      const content = `Keep "${task.title}" overdue without rescheduling.`;
      return {
        content,
        messageType: "action_preview",
        structuredPayload: { link: "/today" },
        actionPreview: {
          actionType: "keep_task_overdue",
          proposedPayload: {
            command: { ...command, taskId: task.id, taskTitle: task.title },
          },
        },
      };
    }

    default: {
      const timerPreview = await buildTimerWritePreview(command);
      if (timerPreview) return timerPreview;
      throw new Error(`Intent not supported for write preview`);
    }
  }
}

export async function executeConfirmedAction(input: {
  actionType: string;
  proposedPayload: Record<string, unknown>;
  actionId: string;
  executedPayload?: Json | null;
  status: string;
}): Promise<ExecutorResponse> {
  if (input.status === "executed" && input.executedPayload) {
    const prior = input.executedPayload as { message?: string };
    return {
      content: prior.message ?? "Action already completed.",
      messageType: "action_result",
      structuredPayload: input.executedPayload as Record<string, unknown>,
    };
  }

  const payload = input.proposedPayload;

  switch (input.actionType) {
    case "create_event": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "create_event" }>;
      const calendar = await getManualCalendar();
      if (!calendar?.is_writable) {
        const err = formatError("The Manual calendar is not writable.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }

      const startAt = toUtcFromAppLocal(
        command.dateKey,
        command.startTime,
      ).toISOString();
      const endAt = toUtcFromAppLocal(
        command.dateKey,
        command.endTime,
      ).toISOString();

      await assertNoBlockingOverlap(startAt, endAt);

      const event = await createEvent(
        {
          title: command.title,
          description: null,
          location: null,
          calendarId: calendar!.id,
          eventType: (command.eventType ?? "personal") as EventType,
          status: "confirmed",
          allDay: false,
          startAt,
          endAt,
        },
        {
          createdByAssistant: true,
          assistantActionId: input.actionId,
        },
      );

      const result = formatActionResult(
        `Created "${event.title}" on ${command.dateKey}.`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { ...result.payload, eventId: event.id, message: result.content },
      };
    }

    case "create_task": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "create_task" }>;

      const dueAt = command.dueDateKey
        ? toUtcFromAppLocal(
            command.dueDateKey,
            command.dueTime ?? "23:59",
          ).toISOString()
        : null;

      const task = await createTask(
        {
          title: command.title,
          description: null,
          dueAt,
          earliestStartAt: null,
          estimatedMinutes: command.estimatedMinutes ?? null,
          remainingMinutes: command.estimatedMinutes ?? null,
          priority: command.priority ?? 3,
          difficulty: command.difficulty ?? 3,
          status: "open",
          splittable: command.splittable ?? true,
          minimumBlockMinutes: command.minimumBlockMinutes ?? 25,
        },
        { source: "assistant" },
      );

      const result = formatActionResult(`Created task "${task.title}".`);
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { ...result.payload, taskId: task.id, message: result.content },
      };
    }

    case "complete_task": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "complete_task" }>;
      if (!command.taskId) {
        const err = formatError("Task not specified.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }

      await setTaskCompletion(command.taskId, true);
      const result = formatActionResult(
        `Marked "${command.taskTitle ?? "task"}" as completed.`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { ...result.payload, message: result.content },
      };
    }

    case "accept_proposals": {
      const proposalIds = (payload.proposalIds as string[]) ?? [];
      const user = await requireAllowedUser();
      const calendar = await getLifeOSPlanningCalendar();
      const preferences = await getPlanningPreferences();
      let accepted = 0;
      let failed = 0;

      for (const proposalId of proposalIds) {
        const supabase = await createClient();
        const { data: proposal } = await supabase
          .from("planning_proposals")
          .select("*")
          .eq("id", proposalId)
          .eq("user_id", user.id)
          .single();

        if (!proposal) {
          failed += 1;
          continue;
        }

        const [events, tasks] = await Promise.all([
          listEventsInRange(proposal.proposed_start_at, proposal.proposed_end_at),
          listTasks({ status: "active" }),
        ]);

        const task = tasks.find((t) => t.id === proposal.task_id);
        const { data: run } = await supabase
          .from("planning_runs")
          .select("*")
          .eq("id", proposal.planning_run_id)
          .single();

        const validation = validateProposalForAcceptance({
          proposal: {
            id: proposal.id,
            taskId: proposal.task_id,
            proposedStartAt: proposal.proposed_start_at,
            proposedEndAt: proposal.proposed_end_at,
            proposedMinutes: proposal.proposed_minutes,
            proposalHash: proposal.proposal_hash,
            status: proposal.status,
            planningRunId: proposal.planning_run_id,
          },
          run: run ? { id: run.id, status: run.status } : { id: "", status: "stale" },
          task: task ? toPlanningTask(task) : null,
          events: events.map(toPlanningEvent),
          preferences: {
            minimumBreakMinutes: preferences.minimum_break_minutes,
            travelBufferMinutes: preferences.travel_buffer_minutes,
            planningBufferPercent: preferences.planning_buffer_percent,
            preferredFocusBlockMinutes: preferences.preferred_focus_block_minutes,
            maximumFocusBlockMinutes: preferences.maximum_focus_block_minutes,
            avoidDifficultWorkAfter: preferences.avoid_difficult_work_after,
          },
          calendarWritable: calendar?.is_writable ?? false,
          userId: user.id,
          ownerUserId: proposal.user_id,
        });

        if (!validation.valid) {
          failed += 1;
          continue;
        }

        await acceptProposal(proposalId);
        accepted += 1;
      }

      const result = formatActionResult(
        `Accepted ${accepted} proposal${accepted === 1 ? "" : "s"}${failed > 0 ? ` (${failed} could not be accepted)` : ""}.`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { accepted, failed, message: result.content },
      };
    }

    case "reject_proposals": {
      const proposalIds = (payload.proposalIds as string[]) ?? [];
      const runId = payload.runId as string | undefined;

      if (runId && proposalIds.length > 1) {
        await rejectAllPendingProposals(runId);
      } else {
        for (const proposalId of proposalIds) {
          await rejectProposal(proposalId);
        }
      }

      const result = formatActionResult(
        `Rejected ${proposalIds.length} proposal${proposalIds.length === 1 ? "" : "s"}.`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    case "regenerate_plan": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "regenerate_plan" }>;
      const result = await generateAndStorePlanningRun({
        periodType: command.periodType,
        weekOffset: command.weekOffset,
      });
      const formatted = formatPlanGeneratedResponse(result);
      return {
        content: formatted.content,
        messageType: "action_result",
        structuredPayload: { ...formatted.payload, message: formatted.content },
      };
    }

    case "clear_chat": {
      const result = formatActionResult("Chat cleared. Your events and tasks are unchanged.");
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    case "set_work_schedule":
    case "add_work_shift":
    case "update_work_shift":
    case "delete_work_shift":
    case "copy_work_schedule": {
      const command = (payload.command ?? payload) as ParsedCommand;
      const message = await executeWorkCommand(command, {
        assistantActionId: input.actionId,
      });
      const result = formatActionResult(message);
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    case "start_timer":
    case "stop_timer":
    case "pause_timer":
    case "resume_timer":
    case "log_time":
    case "use_original_estimate": {
      const command = (payload.command ?? payload) as ParsedCommand;
      const ok = await executeTimerWrite(command);
      if (!ok) {
        const err = formatError("Could not complete the timer action.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      const result = formatActionResult("Timer action completed.");
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    case "create_inbox_task": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "create_inbox_task" }>;
      const task = await createInboxTask({ title: command.title });
      const result = formatActionResult(`Captured "${task.title}" in your inbox.`);
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { taskId: task.id, message: result.content, link: "/inbox" },
      };
    }

    case "defer_task": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "defer_task" }>;
      if (!command.taskId) {
        const err = formatError("Task not specified.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      const untilAt = toUtcEndOfAppLocalDay(command.untilDateKey).toISOString();
      await deferTask(command.taskId, untilAt);
      const result = formatActionResult(
        `Deferred "${command.taskTitle ?? "task"}" until ${command.untilDateKey}.`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    case "mark_waiting": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "mark_waiting" }>;
      if (!command.taskId) {
        const err = formatError("Task not specified.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      const followUpAt = command.followUpDateKey
        ? toUtcFromAppLocalDate(command.followUpDateKey).toISOString()
        : null;
      await markWaiting(command.taskId, {
        reason: command.reason,
        followUpAt,
      });
      const result = formatActionResult(
        `Marked "${command.taskTitle ?? "task"}" as waiting.`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    case "create_recurring_task": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "create_recurring_task" }>;
      const template = await createRecurrenceTemplate({
        title: command.title,
        recurrenceRule: {
          frequency: "weekly",
          interval: 1,
          byWeekday: command.byWeekday,
        },
        firstOccurrenceDate: command.firstOccurrenceDate,
        dueTime: command.dueTime ?? null,
        defaultEstimateMinutes: command.defaultEstimateMinutes ?? null,
      });
      const result = formatActionResult(
        `Created recurring task "${template.title}".`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: {
          templateId: template.id,
          message: result.content,
          link: "/tasks/recurring",
        },
      };
    }

    case "pause_recurring_task": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "pause_recurring_task" }>;
      if (!command.templateId) {
        const err = formatError("Recurring template not specified.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      await executePauseRecurringTask(command.templateId);
      const result = formatActionResult(
        `Paused recurring task "${command.templateTitle ?? "template"}".`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    case "skip_recurrence_occurrence": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "skip_recurrence_occurrence" }>;
      if (!command.templateId) {
        const err = formatError("Recurring template not specified.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      await executeSkipRecurrenceOccurrence(
        command.templateId,
        command.occurrenceDate,
      );
      const result = formatActionResult(
        `Skipped the ${command.occurrenceDate} occurrence.`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    case "preview_rollover": {
      const result = formatActionResult(
        "Rollover preview saved. Open the calendar shelf to schedule individual tasks.",
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: {
          message: result.content,
          preview: payload.preview,
          link: "/calendar",
        },
      };
    }

    case "keep_task_overdue": {
      const command = (payload.command ??
        payload) as Extract<ParsedCommand, { intent: "keep_task_overdue" }>;
      if (!command.taskId) {
        const err = formatError("Task not specified.");
        return {
          content: err.content,
          messageType: "error",
          structuredPayload: err.payload,
        };
      }
      await recordKeepOverdueDecision(command.taskId);
      const result = formatActionResult(
        `Recorded decision to keep "${command.taskTitle ?? "task"}" overdue.`,
      );
      return {
        content: result.content,
        messageType: "action_result",
        structuredPayload: { message: result.content },
      };
    }

    default: {
      const err = formatError("Unknown action type.");
      return {
        content: err.content,
        messageType: "error",
        structuredPayload: err.payload,
      };
    }
  }
}

export function isWriteIntent(command: ParsedCommand): boolean {
  return WRITE_INTENTS.has(command.intent as never);
}

export function isReadOnlyIntent(command: ParsedCommand): boolean {
  return (
    READ_ONLY_INTENTS.has(command.intent as never) || command.intent === "unknown"
  );
}
