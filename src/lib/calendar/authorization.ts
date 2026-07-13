import type { EventWithCalendar } from "@/lib/data/events";
import type { CalendarEditWorkflow } from "@/lib/calendar/types";

export function getEditWorkflow(event: EventWithCalendar): CalendarEditWorkflow {
  if (event.status === "cancelled") {
    return "read_only";
  }

  if (event.event_type === "deadline") {
    return "deadline";
  }

  if (event.source === "academic" || event.class_meeting_id != null) {
    return "academic";
  }

  if (event.source === "canvas" || event.calendar_source === "canvas") {
    return "read_only";
  }

  if (event.source === "microsoft" || event.calendar_source === "microsoft") {
    return "read_only";
  }

  if (event.event_type === "focus_block" && event.related_task_id) {
    return "planning_block";
  }

  if (event.event_type === "work" || event.source === "workforce_import") {
    return "work_shift";
  }

  if (event.is_read_only) {
    return "read_only";
  }

  return "manual";
}

export function canDragEvent(event: EventWithCalendar): boolean {
  const workflow = getEditWorkflow(event);
  return (
    workflow === "manual" ||
    workflow === "work_shift" ||
    workflow === "planning_block"
  );
}

export function canResizeEvent(event: EventWithCalendar): boolean {
  if (event.all_day) return false;
  return canDragEvent(event);
}

export function canEditEvent(event: EventWithCalendar): boolean {
  const workflow = getEditWorkflow(event);
  return workflow === "manual" || workflow === "work_shift";
}

export function canDeleteEvent(event: EventWithCalendar): boolean {
  const workflow = getEditWorkflow(event);
  return workflow === "manual" || workflow === "work_shift";
}
