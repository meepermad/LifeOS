import { parseTimerCommands } from "@/lib/assistant/timer-parser";
import { parseDurationMinutes } from "@/lib/assistant/duration-parser";
import {
  extractDateFromText,
  parseBeforeDate,
  parseRelativeDate,
  parseTimeOfDayPreference,
  parseTimeRange,
} from "@/lib/assistant/date-parser";
import {
  parseAcademicCommands,
} from "@/lib/assistant/academic-parser";
import type { ParseCommandOptions } from "@/lib/assistant/parse-options";
import {
  parseAddWorkShift,
  parseCopyWorkSchedule,
  parseDeleteWorkShift,
  parseSetWorkSchedule,
  parseShowWorkHours,
  parseShowWorkSchedule,
  parseUpdateWorkShift,
  parseWorkOffDay,
} from "@/lib/assistant/work-schedule-parser";
import type {
  PartialCommand,
  ParsedCommand,
  ParseResult,
} from "@/lib/assistant/intents";

function normalizeInput(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function inferEventType(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(dinner|lunch|breakfast|meal)\b/.test(lower)) return "meal";
  if (/\b(meeting)\b/.test(lower)) return "meeting";
  if (/\b(appointment|dentist|doctor)\b/.test(lower)) return "appointment";
  return "personal";
}

function extractTitleAfterVerb(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(
          /\b(on|at|from|for|by|due|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|before|after)\b.*$/i,
          "",
        )
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return null;
}

function parseAgenda(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();

  if (!/\b(what do i have|what does .+ look|agenda|schedule)\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  if (/\bthis week\b/.test(lower)) {
    return { kind: "command", command: { intent: "show_agenda", scope: "week" } };
  }

  if (/\btomorrow\b/.test(lower)) {
    const date = parseRelativeDate("tomorrow", now);
    return {
      kind: "command",
      command: {
        intent: "show_agenda",
        scope: "tomorrow",
        dateKey: date?.dateKey,
      },
    };
  }

  if (/\btoday\b/.test(lower)) {
    return { kind: "command", command: { intent: "show_agenda", scope: "today" } };
  }

  const date = extractDateFromText(text, now);
  if (date) {
    return {
      kind: "command",
      command: { intent: "show_agenda", scope: "date", dateKey: date.dateKey },
    };
  }

  return { kind: "unknown", raw: text };
}

function parseWorkload(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();

  if (!/\b(workload|how busy|busy)\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  if (/\bthis week\b/.test(lower)) {
    return {
      kind: "command",
      command: { intent: "show_workload", scope: "week" },
    };
  }

  if (/\bhow busy is\b/.test(lower)) {
    const date = extractDateFromText(text, now);
    if (date) {
      return {
        kind: "command",
        command: {
          intent: "show_workload",
          scope: "date",
          dateKey: date.dateKey,
        },
      };
    }
  }

  if (/\btomorrow\b/.test(lower)) {
    const date = parseRelativeDate("tomorrow", now);
    return {
      kind: "command",
      command: {
        intent: "show_workload",
        scope: "tomorrow",
        dateKey: date?.dateKey,
      },
    };
  }

  if (/\btoday\b/.test(lower)) {
    return {
      kind: "command",
      command: { intent: "show_workload", scope: "today" },
    };
  }

  return { kind: "unknown", raw: text };
}

function parseAvailability(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();
  const durationMinutes = parseDurationMinutes(text);

  if (!durationMinutes && /\b(free|available|opening|find)\b/.test(lower)) {
    return {
      kind: "clarification",
      partial: { intent: "find_availability" },
      missingField: "duration",
      prompt: "How long do you need? For example: 90 minutes or two hours.",
    };
  }

  if (!durationMinutes) {
    return { kind: "unknown", raw: text };
  }

  const beforeDate = parseBeforeDate(text, now);
  const timeOfDay = parseTimeOfDayPreference(text);
  const startDate = extractDateFromText(text, now);

  return {
    kind: "command",
    command: {
      intent: "find_availability",
      durationMinutes,
      startDateKey: startDate?.dateKey,
      endDateKey: beforeDate?.dateKey ?? startDate?.dateKey,
      beforeDateKey: beforeDate?.dateKey,
      timeOfDay,
    },
  };
}

function parseGeneratePlan(text: string): ParseResult {
  const lower = text.toLowerCase();

  if (
    /\b(generate|regenerate|create)\b.*\b(plan|planning)\b.*\b(week|weekly)\b/.test(
      lower,
    ) ||
    /\bplan\b.*\bthis week\b/.test(lower)
  ) {
    return {
      kind: "command",
      command: { intent: "generate_plan", periodType: "week" },
    };
  }

  if (
    /^plan(\s+today)?\.?$/i.test(text.trim()) ||
    /\b(generate|create)\b.*\bplan\b.*\btoday\b/.test(lower) ||
    /\bplan\s+today\b/.test(lower)
  ) {
    return {
      kind: "command",
      command: { intent: "generate_plan", periodType: "day" },
    };
  }

  return { kind: "unknown", raw: text };
}

function parseCreateEvent(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();
  if (
    /\bwhat\b.+\bschedule\b/i.test(lower) ||
    /\bschedule like\b/i.test(lower) ||
    /\bshow\b.+\bschedule\b/i.test(lower)
  ) {
    return { kind: "unknown", raw: text };
  }

  const isEvent =
    /\b(schedule|appointment|meeting|dinner|lunch|add)\b/.test(lower);

  if (!isEvent) {
    return { kind: "unknown", raw: text };
  }

  const title =
    extractTitleAfterVerb(text, [
      /(?:schedule|add)\s+(?:a\s+)?(.+?)\s+(?:on|at|from|for)\b/i,
      /(?:schedule|add)\s+(.+)/i,
      /(?:dinner|lunch|meeting|appointment)\s+(?:with\s+)?(.+)/i,
    ]) ?? text.replace(/^(schedule|add)\s+(a\s+)?/i, "").trim();

  const date = extractDateFromText(text, now);
  const timeRange = parseTimeRange(text);

  const partial: PartialCommand = {
    intent: "create_event",
    title: title || undefined,
    dateKey: date?.dateKey,
    startTime: timeRange?.startTime,
    endTime: timeRange?.endTime,
    eventType: inferEventType(text),
  };

  if (!partial.title) {
    return {
      kind: "clarification",
      partial,
      missingField: "title",
      prompt: "What should I call this event?",
    };
  }

  if (!partial.dateKey) {
    return {
      kind: "clarification",
      partial,
      missingField: "date",
      prompt: "What day should I schedule it?",
    };
  }

  if (!partial.startTime || !partial.endTime) {
    return {
      kind: "clarification",
      partial,
      missingField: "startTime",
      prompt: "What time should it start and end? For example: 3 to 4 PM.",
    };
  }

  return {
    kind: "command",
    command: partial as ParsedCommand,
  };
}

function parseCreateTask(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase();
  const isTask =
    /\b(create a task|add a task|add a .+ task|task to|task called)\b/.test(
      lower,
    );

  if (!isTask) {
    return { kind: "unknown", raw: text };
  }

  const durationMinutes = parseDurationMinutes(text);
  const date = extractDateFromText(text, now);

  const title =
    extractTitleAfterVerb(text, [
      /create a task (?:to|for|called)\s+(.+)/i,
      /add a (?:\w+(?:-\w+)?\s+)?task (?:called|to)\s+(.+)/i,
      /task (?:called|to)\s+(.+)/i,
    ]) ?? "";

  const partial: PartialCommand = {
    intent: "create_task",
    title: title.replace(/\b(by|due|on)\b.*$/i, "").trim() || undefined,
    dueDateKey: date?.dateKey,
    estimatedMinutes: durationMinutes ?? undefined,
  };

  if (!partial.title) {
    return {
      kind: "clarification",
      partial,
      missingField: "title",
      prompt: "What should the task be called?",
    };
  }

  if (!partial.dueDateKey && /\b(lab|homework|assignment|module)\b/i.test(text)) {
    return {
      kind: "clarification",
      partial,
      missingField: "dueDate",
      prompt: "When is it due?",
    };
  }

  return {
    kind: "command",
    command: {
      intent: "create_task",
      title: partial.title,
      dueDateKey: partial.dueDateKey,
      estimatedMinutes: partial.estimatedMinutes,
      priority: 3,
      difficulty: 3,
      splittable: true,
      minimumBlockMinutes: 25,
    },
  };
}

function parseCompleteTask(text: string): ParseResult {
  const lower = text.toLowerCase();
  if (!/\b(complete|mark .+ done|finish)\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  const titleMatch = text.match(
    /\b(?:complete|finish|mark)\s+(?:the\s+)?(.+?)(?:\s+as\s+done)?\.?$/i,
  );
  const taskTitle = titleMatch?.[1]?.trim();

  if (!taskTitle) {
    return {
      kind: "clarification",
      partial: { intent: "complete_task" },
      missingField: "title",
      prompt: "Which task should I complete?",
    };
  }

  return {
    kind: "command",
    command: { intent: "complete_task", taskTitle },
  };
}

function parseAcceptProposals(text: string): ParseResult {
  const lower = text.toLowerCase();
  if (!/\baccept\b/.test(lower) || !/\bproposal/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  if (/\ball\b/.test(lower)) {
    const periodType = /\bweek\b/.test(lower) ? "week" : "day";
    return {
      kind: "command",
      command: {
        intent: "accept_proposals",
        mode: "period_all",
        periodType,
      },
    };
  }

  const indexMatch = lower.match(/\b(?:proposal\s+)?(\d+|first|second|third)\b/);
  if (indexMatch) {
    const token = indexMatch[1];
    const indexMap: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
    };
    const index = indexMap[token] ?? Number.parseInt(token, 10);
    return {
      kind: "command",
      command: {
        intent: "accept_proposals",
        mode: "index",
        indices: [index],
      },
    };
  }

  return { kind: "unknown", raw: text };
}

function parseRejectProposals(text: string): ParseResult {
  const lower = text.toLowerCase();
  if (!/\breject\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  if (/\ball pending\b/.test(lower) || /\ball proposals\b/.test(lower)) {
    return {
      kind: "command",
      command: {
        intent: "reject_proposals",
        mode: "all",
      },
    };
  }

  const indexMatch = lower.match(/\b(?:proposal\s+)?(\d+|first|second|third)\b/);
  if (indexMatch) {
    const token = indexMatch[1];
    const indexMap: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
    };
    const index = indexMap[token] ?? Number.parseInt(token, 10);
    return {
      kind: "command",
      command: {
        intent: "reject_proposals",
        mode: "index",
        indices: [index],
      },
    };
  }

  const date = extractDateFromText(text);
  if (date) {
    return {
      kind: "command",
      command: {
        intent: "reject_proposals",
        mode: "index",
        indices: [],
        periodType: "day",
      },
    };
  }

  return { kind: "unknown", raw: text };
}

function parseRegeneratePlan(text: string): ParseResult {
  const lower = text.toLowerCase();
  if (!/\bregenerate\b/.test(lower)) {
    return { kind: "unknown", raw: text };
  }

  const periodType = /\bweek\b/.test(lower) ? "week" : "day";
  return {
    kind: "command",
    command: { intent: "regenerate_plan", periodType },
  };
}

export function parseCommand(
  text: string,
  now = new Date(),
  options: ParseCommandOptions = {},
): ParseResult {
  const normalized = normalizeInput(text);
  const lower = normalized.toLowerCase();
  const mergedOptions: ParseCommandOptions = { ...options, now };

  if (lower === "help") {
    return { kind: "command", command: { intent: "help" } };
  }

  if (lower === "clear chat" || lower === "clear") {
    return { kind: "command", command: { intent: "clear_chat" } };
  }

  const parsers: Array<(t: string, n: Date, o: ParseCommandOptions) => ParseResult> = [
    (t) => parseTimerCommands(t),
    (t) => parseRegeneratePlan(t),
    (t) => parseAcceptProposals(t),
    (t) => parseRejectProposals(t),
    (t) => parseCopyWorkSchedule(t),
    (t, n) => parseSetWorkSchedule(t, n),
    (t, n) => parseAddWorkShift(t, n),
    (t, n) => parseUpdateWorkShift(t, n),
    (t, n) => parseDeleteWorkShift(t, n),
    (t, n) => parseWorkOffDay(t, n),
    (t, n) => parseShowWorkSchedule(t, n),
    (t) => parseShowWorkHours(t),
    (t) => parseCompleteTask(t),
    (t, n) => parseCreateTask(t, n),
    (t, n) => parseCreateEvent(t, n),
    (t, n) => parseAvailability(t, n),
    (t, n, o) => parseAcademicCommands(t, n, o),
    (t, n) => parseAgenda(t, n),
    (t, n) => parseWorkload(t, n),
    (t) => parseGeneratePlan(t),
  ];

  for (const parser of parsers) {
    const result = parser(normalized, now, mergedOptions);
    if (result.kind !== "unknown") {
      return result;
    }
  }

  return { kind: "unknown", raw: normalized };
}
