import {
  addAppDays,
  getAppLocalDateKey,
  getDayBoundsInUtc,
  getTodayBoundsUtc,
  getWeekBounds,
  nowInAppTimezone,
  toUtcFromAppLocal,
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

  const dateKey = command.dateKey ?? getAppLocalDateKey(now);
  const bounds = getDayBoundsInUtc(dateKey);
  return { ...bounds, label: dateKey };
}

async function resolveWorkloadSummary(
  command: Extract<ParsedCommand, { intent: "show_workload" }>,
) {
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

export async function executeReadOnly(
  command: ParsedCommand,
): Promise<ExecutorResponse> {
  switch (command.intent) {
    case "help":
      return {
        content: HELP_TEXT,
        messageType: "text",
        structuredPayload: {},
      };

    case "unknown":
      return {
        content: formatUnknownResponse(command.raw),
        messageType: "text",
        structuredPayload: {},
      };

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
        command.scope === "week" ? "this week" : command.dateKey ?? command.scope;
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

    default:
      throw new Error(`Intent ${(command as ParsedCommand).intent} is not read-only`);
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

    default:
      throw new Error(`Intent not supported for write preview`);
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
  return [
    "create_event",
    "create_task",
    "complete_task",
    "accept_proposals",
    "reject_proposals",
    "regenerate_plan",
    "clear_chat",
  ].includes(command.intent);
}

export function isReadOnlyIntent(command: ParsedCommand): boolean {
  return [
    "show_agenda",
    "show_workload",
    "find_availability",
    "generate_plan",
    "help",
    "unknown",
  ].includes(command.intent);
}
