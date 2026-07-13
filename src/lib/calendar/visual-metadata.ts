import type { EventWithCalendar } from "@/lib/data/events";
import type { CalendarVisualVariant } from "@/lib/calendar/types";

export type EventVisualStyle = {
  variant: CalendarVisualVariant;
  backgroundColor: string;
  borderColor: string;
  borderStyle: "solid" | "dashed" | "dotted";
  textColor: string;
  icon: string;
  label: string;
  opacity: number;
  classNames: string[];
};

const STYLES: Record<CalendarVisualVariant, Omit<EventVisualStyle, "variant">> = {
  academic_class: {
    backgroundColor: "rgba(59, 130, 246, 0.25)",
    borderColor: "#3b82f6",
    borderStyle: "solid",
    textColor: "#dbeafe",
    icon: "◈",
    label: "Class",
    opacity: 1,
    classNames: ["lifeos-event-academic"],
  },
  canvas_deadline: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderColor: "#eab308",
    borderStyle: "dashed",
    textColor: "#fef08a",
    icon: "◇",
    label: "Canvas deadline",
    opacity: 1,
    classNames: ["lifeos-event-deadline"],
  },
  work_shift: {
    backgroundColor: "rgba(168, 85, 247, 0.25)",
    borderColor: "#a855f7",
    borderStyle: "solid",
    textColor: "#f3e8ff",
    icon: "⌁",
    label: "Work",
    opacity: 1,
    classNames: ["lifeos-event-work"],
  },
  manual_personal: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "#22c55e",
    borderStyle: "solid",
    textColor: "#dcfce7",
    icon: "●",
    label: "Personal",
    opacity: 1,
    classNames: ["lifeos-event-manual"],
  },
  planning_block: {
    backgroundColor: "rgba(20, 184, 166, 0.25)",
    borderColor: "#14b8a6",
    borderStyle: "dotted",
    textColor: "#ccfbf1",
    icon: "◎",
    label: "Focus block",
    opacity: 1,
    classNames: ["lifeos-event-planning"],
  },
  task_deadline: {
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    borderColor: "#f97316",
    borderStyle: "dashed",
    textColor: "#ffedd5",
    icon: "▲",
    label: "Deadline",
    opacity: 1,
    classNames: ["lifeos-event-task-deadline"],
  },
  university_closure: {
    backgroundColor: "rgba(107, 114, 128, 0.3)",
    borderColor: "#6b7280",
    borderStyle: "solid",
    textColor: "#e5e7eb",
    icon: "⊘",
    label: "Closure",
    opacity: 0.85,
    classNames: ["lifeos-event-closure"],
  },
  academic_period: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderColor: "#6366f1",
    borderStyle: "dotted",
    textColor: "#e0e7ff",
    icon: "ℹ",
    label: "Academic period",
    opacity: 0.9,
    classNames: ["lifeos-event-period"],
  },
  cancelled: {
    backgroundColor: "rgba(75, 85, 99, 0.2)",
    borderColor: "#4b5563",
    borderStyle: "dashed",
    textColor: "#9ca3af",
    icon: "✕",
    label: "Cancelled",
    opacity: 0.6,
    classNames: ["lifeos-event-cancelled", "line-through"],
  },
};

export function resolveVisualVariant(event: EventWithCalendar): CalendarVisualVariant {
  if (event.status === "cancelled") {
    return "cancelled";
  }

  if (event.source === "academic" && event.event_type === "class") {
    return "academic_class";
  }

  if (
    (event.source === "canvas" || event.calendar_source === "canvas") &&
    event.event_type === "deadline"
  ) {
    return "canvas_deadline";
  }

  if (event.event_type === "deadline") {
    return "task_deadline";
  }

  if (event.event_type === "focus_block") {
    return "planning_block";
  }

  if (event.event_type === "work" || event.source === "workforce_import") {
    return "work_shift";
  }

  if (event.all_day && event.event_type === "other" && event.source === "academic") {
    return "university_closure";
  }

  if (event.all_day && event.source === "academic") {
    return "academic_period";
  }

  return "manual_personal";
}

export function getEventVisualStyle(event: EventWithCalendar): EventVisualStyle {
  const variant = resolveVisualVariant(event);
  const base = STYLES[variant];
  return { variant, ...base };
}
