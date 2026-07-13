import type { EventWithCalendar } from "@/lib/data/events";
import type { CalendarFilterPrefs } from "@/lib/calendar/types";
import { DEFAULT_CALENDAR_FILTER_PREFS } from "@/lib/calendar/types";

export function mergeFilterPrefs(
  prefs?: Partial<CalendarFilterPrefs> | null,
): CalendarFilterPrefs {
  return {
    ...DEFAULT_CALENDAR_FILTER_PREFS,
    ...prefs,
  };
}

export function applyCalendarFilters(
  events: EventWithCalendar[],
  filters: CalendarFilterPrefs,
): EventWithCalendar[] {
  const merged = mergeFilterPrefs(filters);

  return events.filter((event) => {
    if (!merged.showCancelled && event.status === "cancelled") {
      return false;
    }

    if (merged.calendarIds && merged.calendarIds.length > 0) {
      if (!merged.calendarIds.includes(event.calendar_id)) {
        return false;
      }
    }

    if (merged.sources && merged.sources.length > 0) {
      if (!merged.sources.includes(event.source as (typeof merged.sources)[number])) {
        return false;
      }
    }

    if (merged.eventTypes && merged.eventTypes.length > 0) {
      if (!merged.eventTypes.includes(event.event_type as (typeof merged.eventTypes)[number])) {
        return false;
      }
    }

    if (!merged.showClasses && event.event_type === "class") {
      return false;
    }

    if (!merged.showWork && (event.event_type === "work" || event.source === "workforce_import")) {
      return false;
    }

    if (!merged.showPlanningBlocks && event.event_type === "focus_block") {
      return false;
    }

    if (
      !merged.showCompletedPlanningBlocks &&
      event.event_type === "focus_block" &&
      event.status === "completed"
    ) {
      return false;
    }

    if (!merged.showDeadlines && event.event_type === "deadline") {
      return false;
    }

    if (merged.blockingOnly && !event.blocks_time) {
      return false;
    }

    return true;
  });
}
