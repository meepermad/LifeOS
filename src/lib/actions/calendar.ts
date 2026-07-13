"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { loadCalendarEvents } from "@/lib/data/calendar";
import { getEventById } from "@/lib/data/events";
import { canDragEvent, canResizeEvent } from "@/lib/calendar/authorization";
import {
  CalendarMutationError,
  routeCalendarMutation,
} from "@/lib/calendar/mutations";
import { ConflictError, AppError } from "@/lib/errors/app-error";
import type { CalendarFilterPrefs, CalendarViewId } from "@/lib/calendar/types";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { updateCalendarPreferences } from "@/lib/data/calendar-preferences";
import type { EventWithCalendar } from "@/lib/data/events";
import type { EventStatus, EventType } from "@/types/domain";
import { parseEventTimesFromIso } from "@/lib/validation/events";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string>;
      code?: string;
      workflowUrl?: string | null;
    };

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }
  if (error instanceof AppError) {
    if (error instanceof CalendarMutationError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        workflowUrl: error.workflowUrl,
      };
    }
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

export async function listEventsInRangeAction(input: {
  start: string;
  end: string;
  filters: CalendarFilterPrefs;
}): Promise<ActionResult<{ events: import("@fullcalendar/core").EventInput[]; eventCount: number; eventRecords: EventWithCalendar[] }>> {
  try {
    const data = await loadCalendarEvents(input);
    return { success: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function moveCalendarEventAction(input: {
  eventId: string;
  startAt: string;
  endAt: string;
}): Promise<ActionResult> {
  try {
    const event = await getEventById(input.eventId);

    if (!canDragEvent(event) && !canResizeEvent(event)) {
      throw new ConflictError("This event cannot be moved from the calendar");
    }

    const parsed = parseEventTimesFromIso({
      startAt: input.startAt,
      endAt: input.endAt,
      allDay: event.all_day,
      title: event.title,
      description: event.description,
      location: event.location,
      calendarId: event.calendar_id,
      eventType: event.event_type as EventType,
      status: event.status as EventStatus,
    });

    await routeCalendarMutation({ eventId: input.eventId, parsed });

    revalidatePath("/calendar");
    revalidatePath("/today");
    revalidatePath("/week");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveCalendarViewPreferenceAction(input: {
  view: CalendarViewId;
  isMobile: boolean;
}): Promise<ActionResult> {
  try {
    await updateCalendarPreferences({
      [input.isMobile ? "calendarMobileView" : "calendarDesktopView"]: input.view,
    });
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveCalendarFilterPrefsAction(
  filters: CalendarFilterPrefs,
): Promise<ActionResult> {
  try {
    await updateCalendarPreferences({ calendarFilterPrefs: filters });
    revalidatePath("/calendar");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getCalendarPreferencesAction(): Promise<
  ActionResult<{
    desktopView: CalendarViewId;
    mobileView: CalendarViewId;
    visibleStartHour: number;
    visibleEndHour: number;
    filterPrefs: CalendarFilterPrefs;
  }>
> {
  try {
    const prefs = await getPlanningPreferences();
    return {
      success: true,
      data: {
        desktopView: (prefs.calendar_desktop_view ?? "week") as CalendarViewId,
        mobileView: (prefs.calendar_mobile_view ?? "threeDay") as CalendarViewId,
        visibleStartHour: prefs.calendar_visible_start_hour ?? 7,
        visibleEndHour: prefs.calendar_visible_end_hour ?? 22,
        filterPrefs: (prefs.calendar_filter_prefs ?? {}) as CalendarFilterPrefs,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}
