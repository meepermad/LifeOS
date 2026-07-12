import {
  formatAppDate,
  formatAppTimeRange,
  getDayBoundsInUtc,
} from "@/lib/dates/timezone";
import type { EventWithCalendar } from "@/lib/data/events";
import type { TaskRow } from "@/types/domain";
import type { WorkloadSummary } from "@/lib/planning/types";

function dateKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let current = startKey;
  while (current <= endKey) {
    keys.push(current);
    const next = new Date(`${current}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    current = next.toISOString().slice(0, 10);
    if (keys.length > 60) break;
  }
  return keys;
}

function eventMinutes(event: EventWithCalendar): number {
  const start = new Date(event.start_at).getTime();
  const end = new Date(event.end_at).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

export function buildScheduleSummary(input: {
  label: string;
  events: EventWithCalendar[];
  tasks: TaskRow[];
  workload?: WorkloadSummary | null;
  startDateKey: string;
  endDateKey: string;
}): { content: string; payload: Record<string, unknown> } {
  const { label, events, tasks, workload, startDateKey, endDateKey } = input;

  const classes = events.filter((e) => e.event_type === "class" && !e.all_day);
  const work = events.filter((e) => e.event_type === "work" && !e.all_day);
  const blocking = events.filter(
    (e) =>
      !e.all_day &&
      e.blocks_time &&
      e.event_type !== "class" &&
      e.event_type !== "work" &&
      e.event_type !== "deadline",
  );
  const deadlines = events.filter((e) => e.event_type === "deadline" || e.all_day);
  const focusBlocks = events.filter((e) => e.event_type === "focus_block");

  const classMinutes = classes.reduce((sum, e) => sum + eventMinutes(e), 0);
  const workMinutes = work.reduce((sum, e) => sum + eventMinutes(e), 0);
  const blockingMinutes = blocking.reduce((sum, e) => sum + eventMinutes(e), 0);
  const focusMinutes = focusBlocks.reduce((sum, e) => sum + eventMinutes(e), 0);
  const totalScheduled = classMinutes + workMinutes + blockingMinutes + focusMinutes;

  const lines: string[] = [];
  lines.push(`Overview for ${label}:`);
  lines.push(
    `${classes.length} class${classes.length === 1 ? "" : "es"}, ${work.length} work shift${work.length === 1 ? "" : "s"}, ${deadlines.length} due item${deadlines.length === 1 ? "" : "s"}.`,
  );
  lines.push(
    `About ${Math.round(totalScheduled / 60)}h scheduled (${Math.round(classMinutes / 60)}h classes, ${Math.round(workMinutes / 60)}h work).`,
  );

  if (workload) {
    lines.push(`Workload: ${workload.status.replace(/_/g, " ")}.`);
    if (workload.status === "overloaded" || workload.status === "heavy") {
      lines.push("You may be overloaded this period.");
    }
    if (workload.availableFocusMinutes > 0) {
      lines.push(`Roughly ${Math.round(workload.availableFocusMinutes / 60)}h open for focus.`);
    }
  }

  const dayKeys = dateKeysBetween(startDateKey, endDateKey);
  lines.push("");
  lines.push("Day by day:");

  for (const dayKey of dayKeys) {
    const { start, end } = getDayBoundsInUtc(dayKey);
    const dayEvents = events.filter(
      (event) =>
        event.start_at < end.toISOString() &&
        event.end_at > start.toISOString(),
    );
    const dayTasks = tasks.filter(
      (task) => task.due_at && task.due_at.slice(0, 10) === dayKey,
    );
    if (dayEvents.length === 0 && dayTasks.length === 0) continue;

    const dayLabel = formatAppDate(`${dayKey}T12:00:00Z`, "EEE MMM d");
    lines.push(`\n${dayLabel}`);

    const timed = dayEvents
      .filter((e) => !e.all_day)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 6);
    for (const event of timed) {
      lines.push(`• ${formatAppTimeRange(event.start_at, event.end_at)} ${event.title}`);
    }
    if (dayTasks.length > 0) {
      lines.push(`• Due: ${dayTasks.slice(0, 3).map((t) => t.title).join("; ")}`);
    }
    if (dayEvents.length > timed.length) {
      lines.push(`• +${dayEvents.length - timed.length} more`);
    }
  }

  return {
    content: lines.join("\n"),
    payload: {
      classCount: classes.length,
      workCount: work.length,
      totalScheduledMinutes: totalScheduled,
      workloadStatus: workload?.status ?? null,
    },
  };
}

export function formatNextClassResponse(
  event: EventWithCalendar | null,
): string {
  if (!event) {
    return "You have no upcoming classes scheduled.";
  }
  const dayLabel = formatAppDate(event.start_at, "EEEE, MMM d");
  return `Your next class is ${event.title} on ${dayLabel} at ${formatAppTimeRange(event.start_at, event.end_at).split(" – ")[0]}.`;
}

export function formatClassesResponse(input: {
  label: string;
  events: EventWithCalendar[];
}): string {
  const classes = input.events
    .filter((e) => e.event_type === "class" && e.status !== "cancelled")
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  if (classes.length === 0) {
    return `No classes ${input.label}.`;
  }

  const lines = [`Classes ${input.label}:`];
  for (const event of classes.slice(0, 10)) {
    lines.push(`• ${formatAppTimeRange(event.start_at, event.end_at)} — ${event.title}`);
  }
  if (classes.length > 10) {
    lines.push(`• +${classes.length - 10} more`);
  }
  return lines.join("\n");
}

export function formatDueItemsResponse(input: {
  label: string;
  tasks: TaskRow[];
  deadlineEvents: EventWithCalendar[];
}): string {
  const lines = [`Due ${input.label}:`];
  if (input.tasks.length === 0 && input.deadlineEvents.length === 0) {
    return `Nothing due ${input.label}.`;
  }
  for (const task of input.tasks.slice(0, 8)) {
    lines.push(`• ${task.title}`);
  }
  for (const event of input.deadlineEvents.slice(0, 5)) {
    lines.push(`• ${event.title}`);
  }
  return lines.join("\n");
}

export function formatAcademicPeriodResponse(input: {
  label: string;
  startDateKey: string;
  endDateKey: string;
}): string {
  const start = formatAppDate(`${input.startDateKey}T12:00:00Z`, "MMM d, yyyy");
  const end = formatAppDate(`${input.endDateKey}T12:00:00Z`, "MMM d, yyyy");
  if (input.startDateKey === input.endDateKey) {
    return `${input.label} is ${start}.`;
  }
  return `${input.label} runs ${start} through ${end}.`;
}
