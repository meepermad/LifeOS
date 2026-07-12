import type {
  EventSource,
  EventStatus,
  EventType,
  TaskSource,
  TaskStatus,
} from "@/types/domain";

export const APP_TIMEZONE = "America/Chicago" as const;

export const EVENT_STATUSES: EventStatus[] = [
  "tentative",
  "confirmed",
  "cancelled",
];

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "class", label: "Class" },
  { value: "work", label: "Work" },
  { value: "meeting", label: "Meeting" },
  { value: "appointment", label: "Appointment" },
  { value: "deadline", label: "Deadline" },
  { value: "focus_block", label: "Focus block" },
  { value: "travel", label: "Travel" },
  { value: "personal", label: "Personal" },
  { value: "meal", label: "Meal" },
  { value: "exercise", label: "Exercise" },
  { value: "other", label: "Other" },
];

export const EVENT_SOURCES: EventSource[] = [
  "manual",
  "lifeos",
  "microsoft",
  "google",
  "canvas",
  "workforce_import",
  "email",
  "academic",
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "deferred", label: "Deferred" },
];

export const TASK_SOURCES: TaskSource[] = [
  "manual",
  "canvas",
  "microsoft",
  "google",
  "email",
  "assistant",
];

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "open",
  "in_progress",
  "deferred",
];

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DEFAULT_CALENDARS = [
  {
    name: "Manual",
    source: "manual" as const,
    is_writable: true,
    is_visible: true,
    sync_enabled: false,
  },
  {
    name: "LifeOS Planning",
    source: "lifeos" as const,
    is_writable: true,
    is_visible: true,
    sync_enabled: false,
  },
  {
    name: "Work",
    source: "manual" as const,
    is_writable: true,
    is_visible: true,
    sync_enabled: false,
  },
  {
    name: "School",
    source: "manual" as const,
    is_writable: true,
    is_visible: true,
    sync_enabled: false,
  },
  {
    name: "Canvas",
    source: "canvas" as const,
    is_writable: false,
    is_visible: true,
    sync_enabled: true,
  },
];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
