import {
  getCalendarWeekBounds,
  parseDateRange,
  type AcademicRangeContext,
} from "@/lib/dates/range-parser";
import { parseRelativeDate, parseTimeRange } from "@/lib/assistant/date-parser";
import { APP_TIMEZONE } from "@/lib/constants";
import type { ValidatedIntentRouterResult } from "./schemas";
import { writeEntitySchemas } from "./schemas";
import type { AllowedIntent } from "./allowlist";
import { ALLOWED_WRITE_INTENTS } from "./allowlist";

export type SemanticValidationContext = {
  message: string;
  now: Date;
  timezone: string;
  academicContext?: AcademicRangeContext;
  minConfidence: number;
};

export type SemanticValidationResult =
  | { ok: true; data: ValidatedIntentRouterResult }
  | { ok: false; reason: string };

function isValidDateKey(dateKey: string): boolean {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function rangePhraseFromKind(
  kind: string,
  offset: number | null | undefined,
): string | null {
  switch (kind) {
    case "day":
      return offset === 1 ? "tomorrow" : offset === -1 ? "yesterday" : "today";
    case "week":
    case "calendar_week":
      if (offset === 1) return "next week";
      if (offset === 2) return "week after next";
      if (offset === -1) return "last week";
      return "this week";
    case "weekend":
      return offset === 1 ? "next weekend" : "this weekend";
    case "month":
      return offset === 1 ? "next month" : "this month";
    case "rolling":
      return "next seven days";
    default:
      return null;
  }
}

export function resolveRangeFromRouter(
  result: ValidatedIntentRouterResult,
  context: SemanticValidationContext,
): ReturnType<typeof parseDateRange> | null {
  if (!result.range) {
    return parseDateRange(context.message, {
      now: context.now,
      timezone: context.timezone,
      academicContext: context.academicContext,
    });
  }

  const { kind, offset, startDate, endDate } = result.range;

  if (kind === "explicit" && startDate && endDate) {
    if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) return null;
    if (endDate < startDate) return null;
    return parseDateRange(`${startDate} to ${endDate}`, {
      now: context.now,
      timezone: context.timezone,
      academicContext: context.academicContext,
    });
  }

  const phrase = rangePhraseFromKind(kind, offset ?? 0);
  if (phrase) {
    return parseDateRange(phrase, {
      now: context.now,
      timezone: context.timezone,
      academicContext: context.academicContext,
    });
  }

  return parseDateRange(context.message, {
    now: context.now,
    timezone: context.timezone,
    academicContext: context.academicContext,
  });
}

function intentRequiresRange(intent: string): boolean {
  return (
    intent === "schedule_summary" ||
    intent === "show_classes" ||
    intent === "show_due_items" ||
    intent === "query_academic_period" ||
    intent === "show_agenda" ||
    intent === "show_workload"
  );
}

function validateWriteEntities(
  intent: AllowedIntent,
  entities: Record<string, unknown>,
  message: string,
  now: Date,
): { ok: true } | { ok: false; reason: string } {
  const schema = writeEntitySchemas[intent as keyof typeof writeEntitySchemas];
  if (!schema) return { ok: true };

  const entityParsed = schema.safeParse(entities);
  if (!entityParsed.success) {
    return { ok: false, reason: "invalid_write_entities" };
  }

  if (intent === "create_event") {
    const eventEntities = entities as {
      title?: string;
      dateKey?: string;
      startTime?: string;
      endTime?: string;
    };
    const title = eventEntities.title;
    let dateKey = eventEntities.dateKey;
    let startTime = eventEntities.startTime;
    let endTime = eventEntities.endTime;

    if (!dateKey) {
      const parsed = parseRelativeDate(message, now);
      dateKey = parsed?.dateKey;
    }
    if (!startTime || !endTime) {
      const times = parseTimeRange(message);
      startTime = startTime ?? times?.startTime;
      endTime = endTime ?? times?.endTime;
    }

    if (!title || !dateKey || !startTime || !endTime) {
      return { ok: false, reason: "insufficient_write_preview" };
    }
  }

  if (intent === "create_task") {
    const taskEntities = entities as { title?: string };
    if (!taskEntities.title) {
      return { ok: false, reason: "insufficient_write_preview" };
    }
  }

  if (intent === "add_work_shift" || intent === "delete_work_shift") {
    const shiftEntities = entities as { dateKey?: string };
    let dateKey = shiftEntities.dateKey;
    if (!dateKey) {
      const parsed = parseRelativeDate(message, now);
      dateKey = parsed?.dateKey;
    }
    if (!dateKey) return { ok: false, reason: "insufficient_write_preview" };
  }

  if (intent === "update_work_shift") {
    const shiftEntities = entities as { sourceDateKey?: string };
    let sourceDateKey = shiftEntities.sourceDateKey;
    if (!sourceDateKey) {
      const parsed = parseRelativeDate(message, now);
      sourceDateKey = parsed?.dateKey;
    }
    if (!sourceDateKey) {
      return { ok: false, reason: "insufficient_write_preview" };
    }
  }

  return { ok: true };
}

export function validateSemanticIntentRouterResult(
  data: ValidatedIntentRouterResult,
  context: SemanticValidationContext,
): SemanticValidationResult {
  if (data.status === "unsupported") {
    return { ok: true, data };
  }

  if (data.status === "clarification_required") {
    return { ok: true, data };
  }

  if (data.confidence < context.minConfidence) {
    return { ok: false, reason: "low_confidence" };
  }

  const intent = data.intent as AllowedIntent;

  if (ALLOWED_WRITE_INTENTS.includes(intent as (typeof ALLOWED_WRITE_INTENTS)[number])) {
    const writeCheck = validateWriteEntities(
      intent,
      data.entities,
      context.message,
      context.now,
    );
    if (!writeCheck.ok) {
      return { ok: false, reason: writeCheck.reason };
    }
  }

  if (intentRequiresRange(intent)) {
    const range = resolveRangeFromRouter(data, context);
    if (!range) {
      return { ok: false, reason: "invalid_date_range" };
    }
  }

  if (intent === "find_availability") {
    const duration = data.entities.durationMinutes;
    if (typeof duration !== "number" || duration <= 0 || duration > 480) {
      return { ok: false, reason: "invalid_duration" };
    }
  }

  if (intent === "show_work_schedule" || intent === "show_work_hours") {
    const weekBounds = getCalendarWeekBounds(
      context.now,
      data.range?.offset ?? 0,
      context.timezone ?? APP_TIMEZONE,
    );
    if (!weekBounds.startKey || !weekBounds.endKey) {
      return { ok: false, reason: "invalid_week_range" };
    }
  }

  return { ok: true, data };
}

export function confidenceBucket(confidence: number): string {
  if (confidence < 0.5) return "0.0-0.5";
  if (confidence < 0.7) return "0.5-0.7";
  if (confidence < 0.85) return "0.7-0.85";
  return "0.85-1.0";
}

export function latencyBucket(ms: number): string {
  if (ms < 500) return "0-500";
  if (ms < 1500) return "500-1500";
  if (ms < 3000) return "1500-3000";
  return "3000+";
}
