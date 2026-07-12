import {
  extractDatePhrase,
  parseDateRange,
  type AcademicRangeContext,
} from "@/lib/dates/range-parser";
import type { ParseResult } from "@/lib/assistant/intents";
import {
  classifyParaphrase,
  toDateRangeRef,
} from "@/lib/assistant/paraphrase";

export function parseAcademicCommands(
  text: string,
  now: Date,
  academicContext?: AcademicRangeContext,
): ParseResult {
  const category = classifyParaphrase(text);
  const range = parseDateRange(text, { now, academicContext });

  if (category === "show_next_class") {
    return { kind: "command", command: { intent: "show_next_class" } };
  }

  if (category === "schedule_summary" && range) {
    return {
      kind: "command",
      command: {
        intent: "schedule_summary",
        range: toDateRangeRef(range),
      },
    };
  }

  if (category === "show_classes" && range) {
    return {
      kind: "command",
      command: {
        intent: "show_classes",
        range: toDateRangeRef(range),
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
          range: toDateRangeRef(range),
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
          range: toDateRangeRef(range),
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
        range: toDateRangeRef(range),
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
        startDateKey: toDateRangeRef(range).startDateKey,
        endDateKey: toDateRangeRef(range).endDateKey,
        range: toDateRangeRef(range),
      },
    };
  }

  if (/\bnext week\b/i.test(text) && /\b(look|going on|rundown|upcoming)\b/i.test(text)) {
    const weekRange = parseDateRange("next week", { now, academicContext });
    if (weekRange) {
      return {
        kind: "command",
        command: {
          intent: "schedule_summary",
          range: toDateRangeRef(weekRange),
        },
      };
    }
  }

  return { kind: "unknown", raw: text };
}

export function extractRecognizedDatePhrase(text: string): string | null {
  return extractDatePhrase(text);
}
