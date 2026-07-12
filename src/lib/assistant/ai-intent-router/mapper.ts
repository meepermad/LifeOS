import { APP_TIMEZONE } from "@/lib/constants";
import { toDateRangeRef } from "@/lib/assistant/paraphrase";
import { parseRelativeDate, parseTimeRange } from "@/lib/assistant/date-parser";
import type {
  MissingField,
  ParseResult,
  PartialCommand,
} from "@/lib/assistant/intents";
import type { ValidatedIntentRouterResult } from "./schemas";
import {
  resolveRangeFromRouter,
  type SemanticValidationContext,
} from "./semantic-validator";

export function mapIntentRouterResultToParseResult(
  result: ValidatedIntentRouterResult,
  context: SemanticValidationContext,
): ParseResult {
  if (result.status === "unsupported") {
    return { kind: "unknown", raw: context.message };
  }

  if (result.status === "clarification_required") {
    const question =
      result.clarificationQuestion?.trim() ?? "Could you clarify that?";
    const partial: PartialCommand = {
      intent: "unknown",
      raw: context.message,
    };
    return {
      kind: "clarification",
      partial,
      missingField: inferMissingField(question),
      prompt: question,
    };
  }

  const intent = result.intent;
  const timezone = context.timezone ?? APP_TIMEZONE;
  const range = resolveRangeFromRouter(result, context);
  const rangeRef = range ? toDateRangeRef(range, timezone) : undefined;

  switch (intent) {
    case "show_next_class":
      return { kind: "command", command: { intent: "show_next_class" } };

    case "schedule_summary":
      if (!rangeRef) return { kind: "unknown", raw: context.message };
      return {
        kind: "command",
        command: { intent: "schedule_summary", range: rangeRef },
      };

    case "show_classes":
      if (!rangeRef) return { kind: "unknown", raw: context.message };
      return {
        kind: "command",
        command: { intent: "show_classes", range: rangeRef },
      };

    case "show_due_items":
      if (!rangeRef) return { kind: "unknown", raw: context.message };
      return {
        kind: "command",
        command: { intent: "show_due_items", range: rangeRef },
      };

    case "query_academic_period":
      if (!rangeRef) return { kind: "unknown", raw: context.message };
      return {
        kind: "command",
        command: {
          intent: "query_academic_period",
          range: rangeRef,
          periodKind: String(result.entities.periodKind ?? "academic period"),
        },
      };

    case "show_agenda": {
      if (!rangeRef) {
        return {
          kind: "command",
          command: { intent: "show_agenda", scope: "today" },
        };
      }
      return {
        kind: "command",
        command: { intent: "show_agenda", scope: "range", range: rangeRef },
      };
    }

    case "show_workload": {
      if (!rangeRef) {
        return {
          kind: "command",
          command: { intent: "show_workload", scope: "week" },
        };
      }
      return {
        kind: "command",
        command: { intent: "show_workload", scope: "range", range: rangeRef },
      };
    }

    case "find_availability": {
      const durationMinutes = Number(result.entities.durationMinutes ?? 60);
      return {
        kind: "command",
        command: {
          intent: "find_availability",
          durationMinutes,
          range: rangeRef,
          timeOfDay:
            result.entities.timeOfDay === "morning" ||
            result.entities.timeOfDay === "afternoon" ||
            result.entities.timeOfDay === "evening"
              ? result.entities.timeOfDay
              : undefined,
        },
      };
    }

    case "show_work_schedule":
      return {
        kind: "command",
        command: {
          intent: "show_work_schedule",
          scope: result.range?.offset === 1 ? "next" : "week",
          weekOffset: result.range?.offset ?? 0,
        },
      };

    case "show_work_hours":
      return {
        kind: "command",
        command: {
          intent: "show_work_hours",
          weekOffset: result.range?.offset ?? 0,
        },
      };

    case "create_event": {
      const entities = result.entities;
      const title = String(entities.title ?? "");
      const parsedDate =
        typeof entities.dateKey === "string"
          ? entities.dateKey
          : parseRelativeDate(context.message, context.now)?.dateKey;
      const times = parseTimeRange(context.message);
      const startTime =
        typeof entities.startTime === "string"
          ? entities.startTime
          : times?.startTime;
      const endTime =
        typeof entities.endTime === "string" ? entities.endTime : times?.endTime;

      if (!title || !parsedDate || !startTime || !endTime) {
        return {
          kind: "clarification",
          partial: { intent: "create_event", title },
          missingField: !parsedDate ? "date" : "shiftTime",
          prompt: "What date and time should I schedule that?",
        };
      }

      return {
        kind: "command",
        command: {
          intent: "create_event",
          title,
          dateKey: parsedDate,
          startTime,
          endTime,
          eventType:
            typeof entities.eventType === "string"
              ? entities.eventType
              : undefined,
        },
      };
    }

    case "create_task": {
      const title = String(result.entities.title ?? "");
      if (!title) {
        return {
          kind: "clarification",
          partial: { intent: "create_task" },
          missingField: "title",
          prompt: "What should I call the task?",
        };
      }
      return {
        kind: "command",
        command: {
          intent: "create_task",
          title,
          dueDateKey:
            typeof result.entities.dueDateKey === "string"
              ? result.entities.dueDateKey
              : undefined,
          dueTime:
            typeof result.entities.dueTime === "string"
              ? result.entities.dueTime
              : undefined,
          estimatedMinutes:
            typeof result.entities.estimatedMinutes === "number"
              ? result.entities.estimatedMinutes
              : undefined,
          priority:
            typeof result.entities.priority === "number"
              ? result.entities.priority
              : undefined,
        },
      };
    }

    case "add_work_shift": {
      const dateKey =
        typeof result.entities.dateKey === "string"
          ? result.entities.dateKey
          : parseRelativeDate(context.message, context.now)?.dateKey;
      if (!dateKey) {
        return {
          kind: "clarification",
          partial: { intent: "add_work_shift" },
          missingField: "shiftDay",
          prompt: "Which day is the work shift?",
        };
      }
      return {
        kind: "command",
        command: {
          intent: "add_work_shift",
          dateKey,
          startTime:
            typeof result.entities.startTime === "string"
              ? result.entities.startTime
              : undefined,
          endTime:
            typeof result.entities.endTime === "string"
              ? result.entities.endTime
              : undefined,
          isOvernight:
            typeof result.entities.isOvernight === "boolean"
              ? result.entities.isOvernight
              : undefined,
        },
      };
    }

    case "update_work_shift": {
      const sourceDateKey =
        typeof result.entities.sourceDateKey === "string"
          ? result.entities.sourceDateKey
          : parseRelativeDate(context.message, context.now)?.dateKey;
      if (!sourceDateKey) {
        return {
          kind: "clarification",
          partial: { intent: "update_work_shift" },
          missingField: "shiftDay",
          prompt: "Which shift should I update?",
        };
      }
      return {
        kind: "command",
        command: {
          intent: "update_work_shift",
          sourceDateKey,
          targetDateKey:
            typeof result.entities.targetDateKey === "string"
              ? result.entities.targetDateKey
              : undefined,
          startTime:
            typeof result.entities.startTime === "string"
              ? result.entities.startTime
              : undefined,
          endTime:
            typeof result.entities.endTime === "string"
              ? result.entities.endTime
              : undefined,
          isOvernight:
            typeof result.entities.isOvernight === "boolean"
              ? result.entities.isOvernight
              : undefined,
        },
      };
    }

    case "delete_work_shift": {
      const dateKey =
        typeof result.entities.dateKey === "string"
          ? result.entities.dateKey
          : parseRelativeDate(context.message, context.now)?.dateKey;
      if (!dateKey) {
        return {
          kind: "clarification",
          partial: { intent: "delete_work_shift" },
          missingField: "shiftDay",
          prompt: "Which work shift should I remove?",
        };
      }
      return {
        kind: "command",
        command: { intent: "delete_work_shift", dateKey },
      };
    }

    default:
      return { kind: "unknown", raw: context.message };
  }
}

function inferMissingField(question: string): MissingField {
  const lower = question.toLowerCase();
  if (lower.includes("monday") || lower.includes("date") || lower.includes("day")) {
    return "date";
  }
  if (lower.includes("am") || lower.includes("pm") || lower.includes("time")) {
    return "shiftTime";
  }
  if (lower.includes("school") || lower.includes("entire schedule")) {
    return "date";
  }
  return "title";
}
