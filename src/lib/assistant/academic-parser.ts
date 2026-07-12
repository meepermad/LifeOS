import {
  extractDatePhrase,
  inferWeekPhrase,
  parseDateRange,
  type AcademicRangeContext,
} from "@/lib/dates/range-parser";
import type { ParseResult } from "@/lib/assistant/intents";
import type { ParseCommandOptions } from "@/lib/assistant/parse-options";
import { APP_TIMEZONE } from "@/lib/constants";
import {
  classifyParaphrase,
  toDateRangeRef,
} from "@/lib/assistant/paraphrase";

function resolveRange(
  text: string,
  options: ParseCommandOptions,
): ReturnType<typeof parseDateRange> {
  const now = options.now ?? new Date();
  const parseOpts = {
    now,
    timezone: options.timezone,
    academicContext: options.academicContext,
  };
  const direct = parseDateRange(text, parseOpts);
  if (direct) return direct;

  const inferred = inferWeekPhrase(text);
  if (inferred) {
    return parseDateRange(inferred, parseOpts);
  }

  return null;
}

export function parseAcademicCommands(
  text: string,
  now: Date,
  options: ParseCommandOptions = {},
): ParseResult {
  const merged: ParseCommandOptions = { ...options, now };
  const category = classifyParaphrase(text);
  const range = resolveRange(text, merged);

  if (category === "show_next_class") {
    return { kind: "command", command: { intent: "show_next_class" } };
  }

  if (category === "schedule_summary" && range) {
    return {
      kind: "command",
      command: {
        intent: "schedule_summary",
        range: toDateRangeRef(range, options.timezone ?? APP_TIMEZONE),
      },
    };
  }

  if (category === "show_classes" && range) {
    return {
      kind: "command",
      command: {
        intent: "show_classes",
        range: toDateRangeRef(range, options.timezone ?? APP_TIMEZONE),
      },
    };
  }

  if (category === "query_academic_period") {
    const phrase =
      text.match(/\bfall break\b|\bspring break\b|\bfinals week\b/i)?.[0] ??
      "academic period";
    if (range) {
      return {
        kind: "command",
        command: {
          intent: "query_academic_period",
          range: toDateRangeRef(range, options.timezone ?? APP_TIMEZONE),
          periodKind: phrase,
        },
      };
    }
    return {
      kind: "command",
      command: {
        intent: "query_academic_period",
        range: {
          phrase,
          startDateKey: "1970-01-01",
          endDateKey: "1970-01-01",
          label: phrase,
        },
        periodKind: phrase,
      },
    };
  }

  if (category === "show_due_items") {
    if (range) {
      return {
        kind: "command",
        command: {
          intent: "show_due_items",
          range: toDateRangeRef(range, options.timezone ?? APP_TIMEZONE),
        },
      };
    }
    return { kind: "unknown", raw: text };
  }

  if (category === "show_workload" && range) {
    return {
      kind: "command",
      command: {
        intent: "show_workload",
        scope: "range",
        range: toDateRangeRef(range, options.timezone ?? APP_TIMEZONE),
      },
    };
  }

  if (category === "find_availability" && range) {
    const durationMatch = text.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i);
    const minutesMatch = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
    const durationMinutes = durationMatch
      ? Number.parseInt(durationMatch[1], 10) * 60
      : minutesMatch
        ? Number.parseInt(minutesMatch[1], 10)
        : 60;
    return {
      kind: "command",
      command: {
        intent: "find_availability",
        durationMinutes,
        startDateKey: toDateRangeRef(range, options.timezone ?? APP_TIMEZONE).startDateKey,
        endDateKey: toDateRangeRef(range, options.timezone ?? APP_TIMEZONE).endDateKey,
        range: toDateRangeRef(range, options.timezone ?? APP_TIMEZONE),
      },
    };
  }

  if (
    /\bnext week\b/i.test(text) &&
    /\b(look|going on|rundown|upcoming)\b/i.test(text)
  ) {
    const weekRange = parseDateRange("next week", {
      now,
      timezone: options.timezone,
      academicContext: options.academicContext,
    });
    if (weekRange) {
      return {
        kind: "command",
        command: {
          intent: "schedule_summary",
          range: toDateRangeRef(weekRange, options.timezone ?? APP_TIMEZONE),
        },
      };
    }
  }

  return { kind: "unknown", raw: text };
}

export function extractRecognizedDatePhrase(text: string): string | null {
  return extractDatePhrase(text) ?? inferWeekPhrase(text);
}

export type { AcademicRangeContext };
