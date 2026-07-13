import { matchTasks } from "@/lib/assistant/entity-matcher";
import { formatDurationMinutes } from "@/lib/analytics/metrics";
import { resolveInsightsRange } from "@/lib/analytics/date-ranges";
import { loadInsights } from "@/lib/data/insights";
import { listTasks } from "@/lib/data/tasks";
import { getProfile } from "@/lib/data/bootstrap";
import type { ParsedCommand } from "@/lib/assistant/intents";
import type { ExecutorResponse } from "@/lib/assistant/executor";
import {
  getActiveTimer,
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  createManualEntry,
} from "@/lib/data/time-entries";
import { createClient } from "@/lib/supabase/server";
import { requireAllowedUser } from "@/lib/auth/authorize-user";

export async function executeTimerReadOnly(
  command: ParsedCommand,
): Promise<ExecutorResponse | null> {
  switch (command.intent) {
    case "show_time_spent": {
      const profile = await getProfile();
      const range = resolveInsightsRange({
        preset: "this_week",
        weekStartsOn: profile.week_starts_on as 0 | 1,
      });
      const insights = await loadInsights(range);
      const minutes = insights.liveTrackedMinutes.value ?? 0;
      return {
        content: `You tracked ${formatDurationMinutes(minutes)} this week.`,
        messageType: "text",
        structuredPayload: { link: "/insights" },
      };
    }
    case "show_estimate_accuracy": {
      const profile = await getProfile();
      const range = resolveInsightsRange({
        preset: "last_4_weeks",
        weekStartsOn: profile.week_starts_on as 0 | 1,
      });
      const insights = await loadInsights(range);
      const ratio = insights.estimationAccuracy.value?.medianRatio;
      const count = insights.estimationAccuracy.sampleCount;
      return {
        content:
          ratio != null
            ? `Your estimates were based on ${count} completed tasks. Median actual-to-estimate ratio: ${ratio.toFixed(2)}.`
            : insights.estimationAccuracy.description,
        messageType: "text",
        structuredPayload: { link: "/insights" },
      };
    }
    case "show_time_breakdown": {
      const profile = await getProfile();
      const range = resolveInsightsRange({
        preset: "this_week",
        weekStartsOn: profile.week_starts_on as 0 | 1,
      });
      const insights = await loadInsights(range);
      const top = [...insights.hoursBySource].sort((a, b) => b.minutes - a.minutes)[0];
      return {
        content: top
          ? `${top.source} entries took the most time this week (${formatDurationMinutes(top.minutes)}).`
          : "No tracked time yet this week.",
        messageType: "text",
        structuredPayload: { link: "/insights" },
      };
    }
    case "show_workload_trends": {
      return {
        content: "Open Insights for workload and estimation trends.",
        messageType: "text",
        structuredPayload: { link: "/insights" },
      };
    }
    case "explain_planning_estimate": {
      return {
        content:
          "Planning uses your estimate plus adaptive calibration when enough completed tasks exist. Open the task or proposal to see the adjustment reason.",
        messageType: "text",
        structuredPayload: { link: "/insights" },
      };
    }
    default:
      return null;
  }
}

export async function buildTimerWritePreview(
  command: ParsedCommand,
): Promise<ExecutorResponse | null> {
  switch (command.intent) {
    case "start_timer":
    case "stop_timer":
    case "pause_timer":
    case "resume_timer":
    case "log_time":
    case "use_original_estimate": {
      const label =
        command.intent === "start_timer"
          ? `Start timer${command.taskTitle ? ` for “${command.taskTitle}”` : ""}`
          : command.intent === "log_time"
            ? `Log ${command.durationMinutes ?? "?"} minutes${command.taskTitle ? ` on “${command.taskTitle}”` : ""}`
            : command.intent.replace("_", " ");
      return {
        content: `Confirm: ${label}?`,
        messageType: "action_preview",
        structuredPayload: {},
        actionPreview: {
          actionType: command.intent,
          proposedPayload: { command },
        },
      };
    }
    default:
      return null;
  }
}

export async function executeTimerWrite(command: ParsedCommand): Promise<boolean> {
  switch (command.intent) {
    case "start_timer": {
      const tasks = await listTasks({ status: "active" });
      const match = matchTasks(command.taskTitle ?? "", tasks);
      if (match.kind !== "exact" && match.kind !== "unique") return false;
      await startTimer(match.task.id);
      return true;
    }
    case "stop_timer":
      await stopTimer();
      return true;
    case "pause_timer":
      await pauseTimer();
      return true;
    case "resume_timer":
      await resumeTimer();
      return true;
    case "log_time": {
      const tasks = await listTasks({ status: "active" });
      const match = matchTasks(command.taskTitle ?? "", tasks);
      if ((match.kind !== "exact" && match.kind !== "unique") || !command.durationMinutes) {
        return false;
      }
      const end = new Date();
      const start = new Date(end.getTime() - command.durationMinutes * 60_000);
      await createManualEntry({
        taskId: match.task.id,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
      });
      return true;
    }
    case "use_original_estimate": {
      const user = await requireAllowedUser();
      const supabase = await createClient();
      const tasks = await listTasks({ status: "active" });
      const match = matchTasks(command.taskTitle ?? "", tasks);
      if (match.kind !== "exact" && match.kind !== "unique") return false;
      await supabase
        .from("tasks")
        .update({ planning_estimate_override: "original" } as never)
        .eq("id", match.task.id)
        .eq("user_id", user.id);
      return true;
    }
    default:
      return false;
  }
}

export async function getActiveTimerSummary(): Promise<string | null> {
  const active = await getActiveTimer();
  if (!active) return null;
  const minutes = Math.floor(active.elapsedSeconds / 60);
  return active.entry.task_title_snapshot
    ? `Timer running: ${active.entry.task_title_snapshot} (${minutes}m)`
    : `Timer running (${minutes}m)`;
}
