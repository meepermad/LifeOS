import {
  formatAppDate,
  formatAppTimeRange,
} from "@/lib/dates/timezone";
import type { AvailabilitySlot } from "@/lib/assistant/availability-finder";
import type { ParsedCommand } from "@/lib/assistant/intents";
import type { WorkloadSummary } from "@/lib/planning/types";
import type { EventWithCalendar } from "@/lib/data/events";
import type { PlanningRunWithProposals } from "@/lib/data/planning";

export const HELP_TEXT = `I understand these planning commands:

• What do I have today? / tomorrow?
• Show my workload this week
• How busy is Wednesday?
• Find 90 minutes before Thursday
• When am I free tomorrow afternoon?
• Plan today / Generate a plan for this week
• Schedule a dentist appointment Tuesday from 3 to 4
• Create a task to finish my networking module by Sunday
• Complete Network Security Lab 4
• Accept all proposals for today
• Reject proposal 2 / Regenerate this week's plan
• help / clear chat

I only act on commands I recognize. Write actions require your confirmation.`;

export function formatUnknownResponse(raw: string): string {
  return `I don't understand "${raw}". Type help to see supported commands.`;
}

export function formatAgendaResponse(input: {
  scope: string;
  events: EventWithCalendar[];
  focusMinutes?: number;
}): { content: string; payload: Record<string, unknown> } {
  const { scope, events, focusMinutes } = input;
  const timed = events.filter((event) => !event.all_day);
  const deadlines = events.filter(
    (event) => event.all_day && event.event_type === "deadline",
  );

  const lines: string[] = [];
  lines.push(
    `Agenda for ${scope}: ${events.length} event${events.length === 1 ? "" : "s"}.`,
  );

  if (timed.length > 0) {
    lines.push("");
    for (const event of timed) {
      lines.push(
        `• ${formatAppTimeRange(event.start_at, event.end_at)} — ${event.title}`,
      );
    }
  }

  if (deadlines.length > 0) {
    lines.push("");
    lines.push("All-day deadlines:");
    for (const event of deadlines) {
      lines.push(`• ${event.title}`);
    }
  }

  if (events.length === 0) {
    lines.push("Nothing scheduled.");
  }

  if (focusMinutes != null && focusMinutes > 0) {
    lines.push("");
    lines.push(`About ${focusMinutes} minutes of open focus time remain.`);
  }

  return {
    content: lines.join("\n"),
    payload: {
      eventCount: events.length,
      link: scope === "week" ? "/week" : "/today",
    },
  };
}

export function formatWorkloadResponse(
  summary: WorkloadSummary,
  scope: string,
): { content: string; payload: Record<string, unknown> } {
  const lines = [
    `Workload for ${scope}: ${summary.status.replace(/_/g, " ")}.`,
    `Fixed commitments: ${summary.fixedMinutes} min`,
    `Available focus: ${summary.availableFocusMinutes} min`,
    `Recommended task time: ${summary.allocatedTaskMinutes} min`,
    `Unallocated: ${summary.unallocatedTaskMinutes} min`,
    `Overdue tasks: ${summary.overdueTaskCount}`,
    `Missing estimates: ${summary.unestimatedTaskCount}`,
  ];

  if (summary.allocation.tasksAtRisk.length > 0) {
    lines.push(`At-risk tasks: ${summary.allocation.tasksAtRisk.length}`);
  }

  return {
    content: lines.join("\n"),
    payload: {
      status: summary.status,
      link: scope === "week" ? "/week" : "/today",
    },
  };
}

export function formatAvailabilityResponse(
  slots: AvailabilitySlot[],
  durationMinutes: number,
): { content: string; payload: Record<string, unknown> } {
  if (slots.length === 0) {
    return {
      content: `I couldn't find any ${durationMinutes}-minute openings in that range. Check your availability rules in Settings.`,
      payload: { slots: [] },
    };
  }

  const lines = [
    `I found ${slots.length} ${durationMinutes}-minute opening${slots.length === 1 ? "" : "s"}:`,
    "",
  ];

  slots.forEach((slot, index) => {
    lines.push(`${index + 1}. ${slot.label}`);
  });

  return {
    content: lines.join("\n"),
    payload: { slots },
  };
}

export function formatPlanGeneratedResponse(
  result: PlanningRunWithProposals,
): { content: string; payload: Record<string, unknown> } {
  const pending = result.proposals.filter((p) => p.status === "pending");
  const totalMinutes = pending.reduce((sum, p) => sum + p.proposed_minutes, 0);

  const periodLabel =
    result.run.period_start === result.run.period_end
      ? "today"
      : "this week";

  return {
    content: [
      `Generated ${pending.length} proposal${pending.length === 1 ? "" : "s"} for ${periodLabel} (${totalMinutes} min total).`,
      "Nothing is added to your calendar until you accept proposals.",
      "Review them on Today or Week, or ask me to accept proposals.",
    ].join("\n"),
    payload: {
      runId: result.run.id,
      proposalCount: pending.length,
      totalMinutes,
      link: "/today",
    },
  };
}

export function formatEventPreview(command: Extract<ParsedCommand, { intent: "create_event" }>): {
  content: string;
  payload: Record<string, unknown>;
} {
  const startAt = `${command.dateKey}T${command.startTime}`;
  const endAt = `${command.dateKey}T${command.endTime}`;

  return {
    content: [
      "Create this event?",
      "",
      command.title,
      formatAppDate(startAt),
      formatAppTimeRange(startAt, endAt),
      "Calendar: Manual",
    ].join("\n"),
    payload: { command },
  };
}

export function formatTaskPreview(command: Extract<ParsedCommand, { intent: "create_task" }>): {
  content: string;
  payload: Record<string, unknown>;
} {
  const lines = [
    "Create this task?",
    "",
    command.title,
  ];

  if (command.dueDateKey) {
    lines.push(`Due: ${formatAppDate(command.dueDateKey)}`);
  }
  if (command.estimatedMinutes) {
    lines.push(`Estimate: ${command.estimatedMinutes} min`);
  } else {
    lines.push("Estimate: not provided (will need estimate)");
  }
  lines.push(`Priority: ${command.priority ?? 3}`);
  lines.push(`Difficulty: ${command.difficulty ?? 3}`);
  lines.push(`Splittable: ${command.splittable ?? true ? "yes" : "no"}`);

  return {
    content: lines.join("\n"),
    payload: { command },
  };
}

export function formatCompleteTaskPreview(input: {
  taskTitle: string;
}): { content: string; payload: Record<string, unknown> } {
  return {
    content: `Mark "${input.taskTitle}" as completed?`,
    payload: input,
  };
}

export function formatProposalActionPreview(input: {
  action: "accept" | "reject" | "regenerate" | "clear";
  count: number;
  totalMinutes?: number;
  periodLabel?: string;
}): { content: string; payload: Record<string, unknown> } {
  switch (input.action) {
    case "accept":
      return {
        content: [
          `Accept ${input.count} proposal${input.count === 1 ? "" : "s"}${input.periodLabel ? ` for ${input.periodLabel}` : ""}?`,
          input.totalMinutes != null
            ? `Total focus time: ${input.totalMinutes} min`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        payload: input,
      };
    case "reject":
      return {
        content: `Reject ${input.count} proposal${input.count === 1 ? "" : "s"}?`,
        payload: input,
      };
    case "regenerate":
      return {
        content: `Regenerate the plan for ${input.periodLabel ?? "this period"}? Pending proposals will become stale.`,
        payload: input,
      };
    case "clear":
      return {
        content:
          "Clear chat history? Pending unconfirmed actions will be cancelled. Events, tasks, and accepted plans are not deleted.",
        payload: input,
      };
  }
}

export function formatActionResult(message: string): {
  content: string;
  payload: Record<string, unknown>;
} {
  return { content: message, payload: {} };
}

export function formatClarification(prompt: string): {
  content: string;
  payload: Record<string, unknown>;
} {
  return { content: prompt, payload: { kind: "clarification" } };
}

export function formatTaskMatchClarification(
  tasks: Array<{ id: string; title: string }>,
): { content: string; payload: Record<string, unknown> } {
  const lines = [
    `I found ${tasks.length} matching tasks. Which one did you mean?`,
    "",
    ...tasks.map((task, index) => `${index + 1}. ${task.title}`),
  ];
  return {
    content: lines.join("\n"),
    payload: { candidates: tasks },
  };
}

export function formatError(message: string): {
  content: string;
  payload: Record<string, unknown>;
} {
  return { content: message, payload: { kind: "error" } };
}
