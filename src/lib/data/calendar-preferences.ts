import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { PlanningPreferencesRow } from "@/types/domain";
import type { CalendarFilterPrefs, CalendarViewId } from "@/lib/calendar/types";
import { DEFAULT_CALENDAR_FILTER_PREFS } from "@/lib/calendar/types";

export type CalendarPreferencesUpdate = {
  calendarDesktopView?: CalendarViewId;
  calendarMobileView?: CalendarViewId;
  calendarVisibleStartHour?: number;
  calendarVisibleEndHour?: number;
  calendarFilterPrefs?: CalendarFilterPrefs;
};

export async function updateCalendarPreferences(
  input: CalendarPreferencesUpdate,
): Promise<PlanningPreferencesRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const update: Partial<{
    calendar_desktop_view: CalendarViewId;
    calendar_mobile_view: CalendarViewId;
    calendar_visible_start_hour: number;
    calendar_visible_end_hour: number;
    calendar_filter_prefs: CalendarFilterPrefs;
  }> = {};
  if (input.calendarDesktopView !== undefined) {
    update.calendar_desktop_view = input.calendarDesktopView;
  }
  if (input.calendarMobileView !== undefined) {
    update.calendar_mobile_view = input.calendarMobileView;
  }
  if (input.calendarVisibleStartHour !== undefined) {
    update.calendar_visible_start_hour = input.calendarVisibleStartHour;
  }
  if (input.calendarVisibleEndHour !== undefined) {
    update.calendar_visible_end_hour = input.calendarVisibleEndHour;
  }
  if (input.calendarFilterPrefs !== undefined) {
    update.calendar_filter_prefs = {
      ...DEFAULT_CALENDAR_FILTER_PREFS,
      ...input.calendarFilterPrefs,
    };
  }

  const { data, error } = await supabase
    .from("planning_preferences")
    .update(update)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update calendar preferences");
  }

  return data;
}

export function getCalendarFilterPrefs(
  row: PlanningPreferencesRow,
): CalendarFilterPrefs {
  const stored = row.calendar_filter_prefs as CalendarFilterPrefs | null;
  return { ...DEFAULT_CALENDAR_FILTER_PREFS, ...stored };
}
