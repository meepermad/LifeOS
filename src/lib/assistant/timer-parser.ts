import type { ParseResult } from "@/lib/assistant/intents";
import { parseDurationMinutes } from "@/lib/assistant/duration-parser";

export function parseTimerCommands(text: string): ParseResult {
  const lower = text.toLowerCase().trim();

  if (/^stop (my )?timer\.?$/.test(lower)) {
    return { kind: "command", command: { intent: "stop_timer" } };
  }
  if (/^pause (my )?timer\.?$/.test(lower)) {
    return { kind: "command", command: { intent: "pause_timer" } };
  }
  if (/^resume (my )?timer\.?$/.test(lower)) {
    return { kind: "command", command: { intent: "resume_timer" } };
  }

  const startMatch = lower.match(/^start (?:a )?timer for (.+?)\.?$/);
  if (startMatch) {
    return {
      kind: "command",
      command: { intent: "start_timer", taskTitle: startMatch[1].trim() },
    };
  }

  const logMatch = lower.match(/^log (\d.+?) on (.+?)\.?$/);
  if (logMatch) {
    const durationMinutes = parseDurationMinutes(logMatch[1]);
    if (durationMinutes != null) {
      return {
        kind: "command",
        command: {
          intent: "log_time",
          durationMinutes,
          taskTitle: logMatch[2].trim(),
        },
      };
    }
  }

  if (/how long did i spend/.test(lower) || /time spent/.test(lower)) {
    return { kind: "command", command: { intent: "show_time_spent" } };
  }
  if (/how accurate have my estimates/.test(lower) || /estimate accuracy/.test(lower)) {
    return { kind: "command", command: { intent: "show_estimate_accuracy" } };
  }
  if (/what did i spend the most time on/.test(lower)) {
    return { kind: "command", command: { intent: "show_time_breakdown" } };
  }
  if (/workload trends/.test(lower)) {
    return { kind: "command", command: { intent: "show_workload_trends" } };
  }

  const explainMatch = lower.match(/why did lifeos schedule (\d+) minutes for (.+)/);
  if (explainMatch) {
    return {
      kind: "command",
      command: {
        intent: "explain_planning_estimate",
        taskTitle: explainMatch[2].trim(),
      },
    };
  }

  if (/use my original estimate/.test(lower)) {
    return { kind: "command", command: { intent: "use_original_estimate" } };
  }

  return { kind: "unknown", raw: text };
}
