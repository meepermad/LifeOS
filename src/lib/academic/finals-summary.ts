import {
  formatAppDate,
  formatAppTimeRange,
} from "@/lib/dates/timezone";
import type { EventWithCalendar } from "@/lib/data/events";
import type { CourseRow } from "@/types/domain";

export function buildFinalsWeekSummary(input: {
  label: string;
  startDateKey: string;
  endDateKey: string;
  courses: CourseRow[];
  events: EventWithCalendar[];
  tasks: Array<{ title: string; due_at: string | null }>;
}): string {
  const { label, startDateKey, endDateKey, courses, events, tasks } = input;
  const start = formatAppDate(`${startDateKey}T12:00:00Z`, "MMM d, yyyy");
  const end = formatAppDate(`${endDateKey}T12:00:00Z`, "MMM d, yyyy");

  const lines: string[] = [];
  lines.push(`${label} runs ${start} through ${end}.`);
  lines.push("");
  lines.push("Final exams:");

  const finalsInRange = events
    .filter(
      (event) =>
        event.status !== "cancelled" &&
        (event.event_type === "exam" ||
          /\bfinal\b/i.test(event.title)) &&
        event.start_at.slice(0, 10) >= startDateKey &&
        event.start_at.slice(0, 10) <= endDateKey,
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const matchedCourseIds = new Set<string>();

  for (const course of courses) {
    const courseFinal = finalsInRange.find((event) => {
      const code = course.code.trim();
      const name = course.name.trim();
      return (
        (code.length > 0 && event.title.includes(code)) ||
        (name.length > 0 && event.title.toLowerCase().includes(name.toLowerCase()))
      );
    });

    if (courseFinal) {
      matchedCourseIds.add(course.id);
      const day = formatAppDate(courseFinal.start_at, "EEE MMM d");
      const time = courseFinal.all_day
        ? "All day"
        : formatAppTimeRange(courseFinal.start_at, courseFinal.end_at);
      lines.push(`• ${course.code || course.name}: ${day} ${time} — ${courseFinal.title}`);
    } else {
      lines.push(`• ${course.code || course.name}: No final recorded`);
    }
  }

  if (courses.length === 0) {
    lines.push("• No courses configured for this term.");
  }

  const deadlines = [
    ...events.filter(
      (e) =>
        e.event_type === "deadline" &&
        e.start_at.slice(0, 10) >= startDateKey &&
        e.start_at.slice(0, 10) <= endDateKey,
    ),
    ...tasks
      .filter(
        (t) =>
          t.due_at &&
          t.due_at.slice(0, 10) >= startDateKey &&
          t.due_at.slice(0, 10) <= endDateKey,
      )
      .map((t) => ({ title: t.title, start_at: t.due_at!, all_day: true })),
  ];

  if (deadlines.length > 0) {
    lines.push("");
    lines.push("Assignment deadlines during finals:");
    for (const item of deadlines.slice(0, 8)) {
      lines.push(`• ${item.title}`);
    }
  }

  return lines.join("\n");
}
