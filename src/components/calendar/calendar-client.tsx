"use client";

import dynamic from "next/dynamic";
import type { CalendarFilterPrefs, CalendarViewId } from "@/lib/calendar/types";
import type { EventInput } from "@fullcalendar/core";
import type { EventWithCalendar } from "@/lib/data/events";

const CalendarShell = dynamic(
  () =>
    import("@/components/calendar/calendar-shell").then((mod) => mod.CalendarShell),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted">Loading calendar…</p>,
  },
);

export function CalendarClient(props: {
  timezone: string;
  weekStartsOn: 0 | 1;
  initialView: CalendarViewId;
  initialDate: string;
  visibleStartHour: number;
  visibleEndHour: number;
  initialFilters: CalendarFilterPrefs;
  initialEvents: EventInput[];
  initialEventRecords: EventWithCalendar[];
}) {
  return <CalendarShell {...props} />;
}
