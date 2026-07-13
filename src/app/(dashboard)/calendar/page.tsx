import { getProfile } from "@/lib/data/bootstrap";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { getCalendarFilterPrefs } from "@/lib/data/calendar-preferences";
import { loadCalendarEvents } from "@/lib/data/calendar";
import { getVisibleRangeForView } from "@/lib/calendar/adapters/view-ranges";
import { listEventsInRange } from "@/lib/data/events";
import { applyCalendarFilters } from "@/lib/calendar/filters";
import type { CalendarViewId } from "@/lib/calendar/types";
import { getAppLocalDateKey, nowInAppTimezone } from "@/lib/dates/timezone";
import { CalendarClient } from "@/components/calendar/calendar-client";

type CalendarPageProps = {
  searchParams: Promise<{ view?: string; date?: string }>;
};

const VALID_VIEWS = new Set<CalendarViewId>([
  "month",
  "week",
  "threeDay",
  "day",
  "agenda",
]);

function parseView(value: string | undefined, fallback: CalendarViewId): CalendarViewId {
  if (value && VALID_VIEWS.has(value as CalendarViewId)) {
    return value as CalendarViewId;
  }
  return fallback;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const profile = await getProfile();
  const prefs = await getPlanningPreferences();
  const filterPrefs = getCalendarFilterPrefs(prefs);

  const timezone = profile.timezone ?? "America/Chicago";
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const defaultDesktopView = parseView(prefs.calendar_desktop_view, "week");
  const initialView = parseView(params.view, defaultDesktopView);
  const initialDate =
    params.date ?? getAppLocalDateKey(nowInAppTimezone());

  const range = getVisibleRangeForView({
    view: initialView,
    anchorDate: initialDate,
    weekStartsOn,
    timezone,
  });

  const [{ events }, rawEvents] = await Promise.all([
    loadCalendarEvents({
      start: range.queryStart,
      end: range.queryEnd,
      filters: filterPrefs,
    }),
    listEventsInRange(range.queryStart, range.queryEnd, {
      includeCancelled: filterPrefs.showCancelled ?? false,
    }),
  ]);

  const filteredRecords = applyCalendarFilters(rawEvents, filterPrefs);

  return (
    <CalendarClient
      timezone={timezone}
      weekStartsOn={weekStartsOn}
      initialView={initialView}
      initialDate={initialDate}
      visibleStartHour={prefs.calendar_visible_start_hour ?? 7}
      visibleEndHour={prefs.calendar_visible_end_hour ?? 22}
      initialFilters={filterPrefs}
      initialEvents={events}
      initialEventRecords={filteredRecords}
    />
  );
}
