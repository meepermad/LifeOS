import { parseDurationMinutes } from "@/lib/assistant/duration-parser";
import {
  extractDateFromText,
  parseTimeRange,
} from "@/lib/assistant/date-parser";
import { resolveShiftTimeRange } from "@/lib/work/shift-time-resolver";
import type {
  ClarificationState,
  PartialCommand,
  ParsedCommand,
  ParseResult,
} from "@/lib/assistant/intents";

export function mergeClarification(
  state: ClarificationState,
  followUpText: string,
  now = new Date(),
): ParseResult {
  const missing = state.missingFields[0];
  const partial = { ...state.partialPayload };

  switch (missing) {
    case "duration": {
      const durationMinutes = parseDurationMinutes(followUpText);
      if (!durationMinutes) {
        return {
          kind: "clarification",
          partial,
          missingField: "duration",
          prompt: "Please provide a duration like 90 minutes or two hours.",
        };
      }
      return {
        kind: "command",
        command: {
          intent: "find_availability",
          durationMinutes,
          startDateKey: (partial as Extract<PartialCommand, { intent: "find_availability" }>).startDateKey,
          endDateKey: (partial as Extract<PartialCommand, { intent: "find_availability" }>).endDateKey,
          beforeDateKey: (partial as Extract<PartialCommand, { intent: "find_availability" }>).beforeDateKey,
          timeOfDay: (partial as Extract<PartialCommand, { intent: "find_availability" }>).timeOfDay,
        },
      };
    }
    case "date": {
      const date = extractDateFromText(followUpText, now);
      if (!date) {
        return {
          kind: "clarification",
          partial,
          missingField: "date",
          prompt: "Which day? For example: Wednesday or tomorrow.",
        };
      }
      if (partial.intent === "create_event") {
        const eventPartial = partial as Extract<PartialCommand, { intent: "create_event" }>;
        if (!eventPartial.startTime) {
          return {
            kind: "clarification",
            partial: { ...eventPartial, dateKey: date.dateKey },
            missingField: "startTime",
            prompt: "What time should it start and end?",
          };
        }
        return {
          kind: "command",
          command: {
            intent: "create_event",
            title: eventPartial.title!,
            dateKey: date.dateKey,
            startTime: eventPartial.startTime,
            endTime: eventPartial.endTime!,
            eventType: eventPartial.eventType,
          },
        };
      }
      return {
        kind: "command",
        command: {
          ...partial,
          dateKey: date.dateKey,
        } as ParsedCommand,
      };
    }
    case "startTime": {
      const timeRange = parseTimeRange(followUpText);
      if (!timeRange) {
        return {
          kind: "clarification",
          partial,
          missingField: "startTime",
          prompt: "What time should it start and end?",
        };
      }
      return {
        kind: "command",
        command: {
          ...partial,
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
        } as ParsedCommand,
      };
    }
    case "dueDate": {
      const date = extractDateFromText(followUpText, now);
      if (!date) {
        return {
          kind: "clarification",
          partial,
          missingField: "dueDate",
          prompt: "When is it due?",
        };
      }
      const taskPartial = partial as Extract<PartialCommand, { intent: "create_task" }>;
      return {
        kind: "command",
        command: {
          intent: "create_task",
          title: taskPartial.title!,
          dueDateKey: date.dateKey,
          estimatedMinutes: taskPartial.estimatedMinutes,
          priority: taskPartial.priority ?? 3,
          difficulty: taskPartial.difficulty ?? 3,
          splittable: taskPartial.splittable ?? true,
          minimumBlockMinutes: taskPartial.minimumBlockMinutes ?? 25,
        },
      };
    }
    case "title": {
      if (partial.intent === "complete_task") {
        return {
          kind: "command",
          command: { intent: "complete_task", taskTitle: followUpText.trim() },
        };
      }
      return {
        kind: "command",
        command: { ...partial, title: followUpText.trim() } as ParsedCommand,
      };
    }
    case "shiftDay": {
      const date = extractDateFromText(followUpText, now);
      const dayMatch = followUpText.toLowerCase().match(
        /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
      );
      let dateKey = date?.dateKey;
      if (!dateKey && dayMatch) {
        const weekdayDate = extractDateFromText(dayMatch[1], now);
        dateKey = weekdayDate?.dateKey;
      }
      if (!dateKey) {
        return {
          kind: "clarification",
          partial,
          missingField: "shiftDay",
          prompt: "Which day? For example: Monday or tomorrow.",
        };
      }
      if (partial.intent === "delete_work_shift") {
        return {
          kind: "command",
          command: { intent: "delete_work_shift", dateKey },
        };
      }
      return {
        kind: "clarification",
        partial: { intent: "add_work_shift", dateKey } as PartialCommand,
        missingField: "shiftTime",
        prompt: "What are the start and end times?",
      };
    }
    case "shiftTime": {
  const resolved = resolveShiftTimeRange(followUpText);
  if (resolved.kind === "clarification") {
    return {
      kind: "clarification",
      partial,
      missingField: "shiftTime",
      prompt: resolved.prompt,
    };
  }
      const partialWithDate = partial as PartialCommand & { dateKey?: string };
      if (partial.intent === "add_work_shift" && partialWithDate.dateKey) {
        return {
          kind: "command",
          command: {
            intent: "add_work_shift",
            dateKey: partialWithDate.dateKey,
            startTime: resolved.value.startTime,
            endTime: resolved.value.endTime,
            isOvernight: resolved.value.isOvernight,
          },
        };
      }
      return {
        kind: "unknown",
        raw: followUpText,
      };
    }
    case "taskMatch": {
      const index = Number.parseInt(followUpText.trim(), 10);
      if (!Number.isFinite(index) || index < 1) {
        return {
          kind: "clarification",
          partial,
          missingField: "taskMatch",
          prompt: "Reply with the number of the task you mean.",
        };
      }
      const candidates = (
        partial as PartialCommand & {
          candidates?: Array<{ id: string; title: string }>;
        }
      ).candidates;
      const selected = candidates?.[index - 1];
      if (!selected) {
        return {
          kind: "clarification",
          partial,
          missingField: "taskMatch",
          prompt: "That number is not in the list. Try again.",
        };
      }
      return {
        kind: "command",
        command: {
          intent: "complete_task",
          taskId: selected.id,
          taskTitle: selected.title,
        },
      };
    }
    default:
      return {
        kind: "unknown",
        raw: followUpText,
      };
  }
}

export const CLARIFICATION_EXPIRY_MINUTES = 15;
export const PROPOSED_ACTION_EXPIRY_MINUTES = 30;

export function clarificationExpiresAt(now = new Date()): string {
  return new Date(
    now.getTime() + CLARIFICATION_EXPIRY_MINUTES * 60_000,
  ).toISOString();
}

export function proposedActionExpiresAt(now = new Date()): string {
  return new Date(
    now.getTime() + PROPOSED_ACTION_EXPIRY_MINUTES * 60_000,
  ).toISOString();
}
