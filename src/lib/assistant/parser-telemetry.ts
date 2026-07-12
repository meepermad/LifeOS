import type { ParsedDateRange } from "@/lib/dates/range-parser";

export function telemetryFromParsedRange(range: ParsedDateRange | null): {
  dateRangeKind: string | null;
  weekOffset: number | null;
} {
  if (!range) {
    return { dateRangeKind: null, weekOffset: null };
  }

  if (range.kind === "week") {
    const weekOffset =
      range.phrase === "next week"
        ? 1
        : range.phrase === "week after next"
          ? 2
          : range.phrase === "last week"
            ? -1
            : 0;
    return { dateRangeKind: "week", weekOffset };
  }

  return { dateRangeKind: range.kind, weekOffset: null };
}

export function telemetryFromCommand(command: {
  intent: string;
  range?: { phrase?: string };
}): {
  dateRangeKind: string | null;
  weekOffset: number | null;
} {
  if (!command.range?.phrase) {
    return { dateRangeKind: null, weekOffset: null };
  }

  const phrase = command.range.phrase;
  if (phrase === "next week") return { dateRangeKind: "week", weekOffset: 1 };
  if (phrase === "week after next") return { dateRangeKind: "week", weekOffset: 2 };
  if (phrase === "last week") return { dateRangeKind: "week", weekOffset: -1 };
  if (phrase === "this week") return { dateRangeKind: "week", weekOffset: 0 };
  if (phrase === "next seven days") return { dateRangeKind: "rolling", weekOffset: null };
  if (phrase === "today" || phrase === "tomorrow" || phrase === "yesterday") {
    return { dateRangeKind: "day", weekOffset: null };
  }
  if (phrase === "this weekend" || phrase === "next weekend") {
    return { dateRangeKind: "weekend", weekOffset: phrase === "next weekend" ? 1 : 0 };
  }
  if (phrase === "this month" || phrase === "next month") {
    return { dateRangeKind: "month", weekOffset: phrase === "next month" ? 1 : 0 };
  }
  if (
    phrase === "fall break" ||
    phrase === "spring break" ||
    phrase === "finals week" ||
    phrase === "current semester" ||
    phrase === "next semester"
  ) {
    return { dateRangeKind: "academic", weekOffset: null };
  }

  return { dateRangeKind: "explicit", weekOffset: null };
}
