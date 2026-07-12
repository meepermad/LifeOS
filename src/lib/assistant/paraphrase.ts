import type { ParsedDateRange } from "@/lib/dates/range-parser";

export type ParaphraseCategory =
  | "schedule_summary"
  | "show_workload"
  | "show_next_class"
  | "show_classes"
  | "query_academic_period"
  | "show_due_items"
  | "find_availability"
  | "show_agenda"
  | null;

const SCHEDULE_SUMMARY_PATTERNS = [
  /\bwhat does .+ look like\b/i,
  /\bwhat do i have going on\b/i,
  /\bgive me a rundown\b/i,
  /\bshow my upcoming week\b/i,
  /\bwhat does school look like\b/i,
  /\bupcoming week\b/i,
];

const NEXT_CLASS_PATTERNS = [/\bwhen is my next class\b/i];

const SHOW_CLASSES_PATTERNS = [
  /\bwhat classes do i have\b/i,
  /\bdo i have classes\b/i,
  /\bclasses (on|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
];

const ACADEMIC_PERIOD_PATTERNS = [
  /\bwhen is fall break\b/i,
  /\bwhen is spring break\b/i,
  /\bshow my finals week\b/i,
  /\bfinals week\b/i,
];

const DUE_ITEMS_PATTERNS = [/\bwhat is due during\b/i, /\bdue during\b/i];

const FREE_TIME_PATTERNS = [
  /\bhow much free time\b/i,
  /\bhow much time do i have free\b/i,
];

export function classifyParaphrase(text: string): ParaphraseCategory {
  const lower = text.toLowerCase();

  if (NEXT_CLASS_PATTERNS.some((p) => p.test(lower))) return "show_next_class";
  if (DUE_ITEMS_PATTERNS.some((p) => p.test(lower))) return "show_due_items";
  if (ACADEMIC_PERIOD_PATTERNS.some((p) => p.test(lower))) {
    return "query_academic_period";
  }
  if (SHOW_CLASSES_PATTERNS.some((p) => p.test(lower))) return "show_classes";
  if (FREE_TIME_PATTERNS.some((p) => p.test(lower))) return "find_availability";
  if (SCHEDULE_SUMMARY_PATTERNS.some((p) => p.test(lower))) {
    return "schedule_summary";
  }
  if (/\bhow busy\b/i.test(lower)) return "show_workload";
  if (/\b(agenda|schedule)\b/i.test(lower)) return "show_agenda";

  return null;
}

export function toDateRangeRef(range: ParsedDateRange): {
  phrase: string;
  startDateKey: string;
  endDateKey: string;
  label: string;
} {
  const startDateKey = range.start.toISOString().slice(0, 10);
  const endDateKey = range.end.toISOString().slice(0, 10);
  return {
    phrase: range.phrase,
    startDateKey,
    endDateKey,
    label: range.label,
  };
}

export function suggestIntentsForUnknown(text: string): string[] {
  const category = classifyParaphrase(text);
  const suggestions: string[] = [];

  if (category) {
    suggestions.push(category.replace(/_/g, " "));
  } else {
    if (/\bweek\b/i.test(text)) {
      suggestions.push("schedule summary for next week");
      suggestions.push("workload for next week");
    }
    if (/\bclass/i.test(text)) {
      suggestions.push("show my classes tomorrow");
      suggestions.push("when is my next class");
    }
    if (/\bbreak\b/i.test(text)) {
      suggestions.push("when is fall break");
    }
  }

  if (suggestions.length === 0) {
    suggestions.push("what does next week look like");
    suggestions.push("show my workload this week");
    suggestions.push("what do I have today");
  }

  return suggestions.slice(0, 3);
}
