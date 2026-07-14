import { parseDurationMinutes } from "@/lib/assistant/duration-parser";
import {
  extractDateFromText,
  parseRelativeDate,
} from "@/lib/assistant/date-parser";
import type { ParseResult } from "@/lib/assistant/intents";
import { getAppLocalDateKey } from "@/lib/dates/timezone";

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function extractQuotedTitle(text: string): string | null {
  const quoted = text.match(/["“](.+?)["”]/);
  if (quoted?.[1]) return quoted[1].trim();
  return null;
}

export function parsePhase13Commands(text: string, now: Date): ParseResult {
  const lower = text.toLowerCase().trim();

  if (
    /\b(add|capture|put)\b.+\b(inbox|in my inbox)\b/i.test(lower) ||
    /\binbox\b.+\b(add|capture)\b/i.test(lower)
  ) {
    const title =
      extractQuotedTitle(text) ??
      text
        .replace(/^(add|capture|put)\s+/i, "")
        .replace(/\b(to|in|into)\s+(my\s+)?inbox\b.*$/i, "")
        .replace(/^inbox\s+/i, "")
        .trim();
    if (!title) {
      return {
        kind: "clarification",
        partial: { intent: "create_inbox_task" },
        missingField: "title",
        prompt: "What should I add to your inbox?",
      };
    }
    return {
      kind: "command",
      command: { intent: "create_inbox_task", title },
    };
  }

  if (/\b(show|open|what is in)\b.*\binbox\b/i.test(lower)) {
    return { kind: "command", command: { intent: "show_inbox" } };
  }

  if (/\b(start|begin|open)\b.*\b(morning review|daily review)\b/i.test(lower)) {
    return { kind: "command", command: { intent: "start_morning_review" } };
  }

  if (/\b(start|begin|open)\b.*\bweekly review\b/i.test(lower)) {
    return { kind: "command", command: { intent: "start_weekly_review" } };
  }

  if (
    /\bhelp\b.*\b(plan|me plan)\b.*\btoday\b/i.test(lower) ||
    /\bwhat should i (do|focus on) today\b/i.test(lower)
  ) {
    return { kind: "command", command: { intent: "help_plan_today" } };
  }

  if (/\b(pending decisions|needs a decision|overdue decisions)\b/i.test(lower)) {
    return { kind: "command", command: { intent: "show_pending_decisions" } };
  }

  if (/\b(show|list)\b.*\bawaiting feedback\b/i.test(lower)) {
    return { kind: "command", command: { intent: "show_awaiting_feedback" } };
  }

  if (/\b(show|list)\b.*\brecurring\b/i.test(lower)) {
    return { kind: "command", command: { intent: "show_recurring_tasks" } };
  }

  if (
    /\b(find time|schedule)\b.*\bunscheduled\b/i.test(lower) ||
    /\bunscheduled tasks?\b/i.test(lower)
  ) {
    return { kind: "command", command: { intent: "find_time_unscheduled" } };
  }

  if (/\bpreview\b.*\brollover\b/i.test(lower)) {
    const date = extractDateFromText(text, now);
    return {
      kind: "command",
      command: {
        intent: "preview_rollover",
        targetDateKey: date?.dateKey ?? getAppLocalDateKey(now),
      },
    };
  }

  if (
    /\bmove\b.+\bunfinished\b.+\btomorrow\b/i.test(lower) ||
    /\bunfinished\b.+\bto\s+tomorrow\b/i.test(lower)
  ) {
    return {
      kind: "command",
      command: {
        intent: "preview_rollover",
        targetDateKey: getAppLocalDateKey(now),
      },
    };
  }

  if (/\b(defer|snooze)\b/.test(lower)) {
    const titleMatch = text.match(
      /\b(?:defer|snooze)\s+(?:the\s+)?(.+?)(?:\s+until|\s+to|\s+till|$)/i,
    );
    const date =
      extractDateFromText(text, now) ??
      parseRelativeDate("tomorrow", now) ??
      undefined;
    const taskTitle = titleMatch?.[1]?.trim();
    if (!taskTitle) {
      return {
        kind: "clarification",
        partial: { intent: "defer_task" },
        missingField: "title",
        prompt: "Which task should I defer?",
      };
    }
    if (!date) {
      return {
        kind: "clarification",
        partial: { intent: "defer_task", taskTitle },
        missingField: "date",
        prompt: "Defer until when?",
      };
    }
    return {
      kind: "command",
      command: {
        intent: "defer_task",
        taskTitle,
        untilDateKey: date.dateKey,
      },
    };
  }

  if (/\bmark\b.+\bwaiting\b/i.test(lower)) {
    const titleMatch = text.match(
      /\bmark\s+(?:the\s+)?(.+?)\s+(?:as\s+)?waiting\b/i,
    );
    const reasonMatch = text.match(/\bwaiting\s+(?:on|for)\s+(.+?)(?:\.|$)/i);
    const taskTitle = titleMatch?.[1]?.trim();
    if (!taskTitle) {
      return {
        kind: "clarification",
        partial: { intent: "mark_waiting" },
        missingField: "title",
        prompt: "Which task should I mark as waiting?",
      };
    }
    return {
      kind: "command",
      command: {
        intent: "mark_waiting",
        taskTitle,
        reason: reasonMatch?.[1]?.trim() ?? "Waiting on someone else",
      },
    };
  }

  if (/\bkeep\b.+\boverdue\b/i.test(lower)) {
    const titleMatch = text.match(/\bkeep\s+(?:the\s+)?(.+?)\s+overdue/i);
    const taskTitle = titleMatch?.[1]?.trim();
    if (!taskTitle) {
      return {
        kind: "clarification",
        partial: { intent: "keep_task_overdue" },
        missingField: "title",
        prompt: "Which overdue task should stay overdue?",
      };
    }
    return {
      kind: "command",
      command: { intent: "keep_task_overdue", taskTitle },
    };
  }

  if (/\b(create|add)\b.*\brecurring\b/i.test(lower)) {
    const title =
      extractQuotedTitle(text) ??
      text
        .replace(/^(create|add)\s+(a\s+)?recurring\s+task\s+/i, "")
        .replace(/\bevery\b.*$/i, "")
        .trim();
    const weekdayMatch = lower.match(
      /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    );
    const byWeekday = weekdayMatch
      ? [WEEKDAY_MAP[weekdayMatch[1]]]
      : [now.getDay()];
    const estimate = parseDurationMinutes(text) ?? undefined;
    if (!title) {
      return {
        kind: "clarification",
        partial: { intent: "create_recurring_task" },
        missingField: "title",
        prompt: "What recurring task should I create?",
      };
    }
    return {
      kind: "command",
      command: {
        intent: "create_recurring_task",
        title,
        byWeekday,
        firstOccurrenceDate: getAppLocalDateKey(now),
        defaultEstimateMinutes: estimate,
      },
    };
  }

  if (/\bpause\b.*\brecurring\b/i.test(lower)) {
    const titleMatch = text.match(/\bpause\s+(?:the\s+)?(?:recurring\s+)?(.+)$/i);
    return {
      kind: "command",
      command: {
        intent: "pause_recurring_task",
        templateTitle: titleMatch?.[1]?.trim(),
      },
    };
  }

  if (/\bskip\b.*\boccurrence\b/i.test(lower)) {
    const date = extractDateFromText(text, now);
    const titleMatch = text.match(/\bskip\s+(?:the\s+)?(.+?)\s+occurrence/i);
    return {
      kind: "command",
      command: {
        intent: "skip_recurrence_occurrence",
        templateTitle: titleMatch?.[1]?.trim(),
        occurrenceDate: date?.dateKey ?? getAppLocalDateKey(now),
      },
    };
  }

  return { kind: "unknown", raw: text };
}
