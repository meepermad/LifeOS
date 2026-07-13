import type { EventSource, EventType } from "@/types/domain";

export type CalendarViewId =
  | "month"
  | "week"
  | "threeDay"
  | "day"
  | "agenda";

export type CalendarEditWorkflow =
  | "manual"
  | "work_shift"
  | "planning_block"
  | "read_only"
  | "academic"
  | "deadline";

export type CalendarVisualVariant =
  | "academic_class"
  | "canvas_deadline"
  | "work_shift"
  | "manual_personal"
  | "planning_block"
  | "task_deadline"
  | "university_closure"
  | "academic_period"
  | "cancelled";

export type CalendarFilterPrefs = {
  calendarIds?: string[];
  sources?: EventSource[];
  eventTypes?: EventType[];
  showClasses?: boolean;
  showWork?: boolean;
  showPlanningBlocks?: boolean;
  showDeadlines?: boolean;
  blockingOnly?: boolean;
  showCompletedPlanningBlocks?: boolean;
  showCancelled?: boolean;
};

export type CalendarRenderEventExtendedProps = {
  lifeosId: string;
  source: string;
  eventType: string;
  isReadOnly: boolean;
  editWorkflow: CalendarEditWorkflow;
  visualVariant: CalendarVisualVariant;
  linkedTaskId: string | null;
  linkedCourseLabel: string | null;
  blocksTime: boolean;
  calendarName: string;
  location: string | null;
  status: string;
  classMeetingId: string | null;
  durationMinutes: number;
};

export const DEFAULT_CALENDAR_FILTER_PREFS: CalendarFilterPrefs = {
  showClasses: true,
  showWork: true,
  showPlanningBlocks: true,
  showDeadlines: true,
  blockingOnly: false,
  showCompletedPlanningBlocks: true,
  showCancelled: false,
};

export const CALENDAR_VIEW_LABELS: Record<CalendarViewId, string> = {
  month: "Month",
  week: "Week",
  threeDay: "3 day",
  day: "Day",
  agenda: "Agenda",
};

export function calendarViewToFullCalendar(view: CalendarViewId): string {
  switch (view) {
    case "month":
      return "dayGridMonth";
    case "week":
      return "timeGridWeek";
    case "threeDay":
      return "timeGridThreeDay";
    case "day":
      return "timeGridDay";
    case "agenda":
      return "listWeek";
    default:
      return "timeGridWeek";
  }
}

export function fullCalendarViewToCalendarView(fcView: string): CalendarViewId {
  if (fcView.startsWith("dayGrid")) return "month";
  if (fcView === "timeGridThreeDay") return "threeDay";
  if (fcView === "timeGridDay") return "day";
  if (fcView.startsWith("list")) return "agenda";
  return "week";
}
