"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  DatesSetArg,
  EventApi,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import "@/components/calendar/calendar.css";

import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { EventInspector } from "@/components/calendar/event-inspector";
import { TaskShelf, type ShelfEligibleTask } from "@/components/calendar/task-shelf";
import {
  listEventsInRangeAction,
  moveCalendarEventAction,
  saveCalendarFilterPrefsAction,
  saveCalendarViewPreferenceAction,
} from "@/lib/actions/calendar";
import { scheduleTaskFromShelfAction } from "@/lib/actions/task-shelf";
import {
  calendarViewToFullCalendar,
  fullCalendarViewToCalendarView,
  type CalendarFilterPrefs,
  type CalendarRenderEventExtendedProps,
  type CalendarViewId,
} from "@/lib/calendar/types";
import { formatHourForSlot } from "@/lib/calendar/adapters/view-ranges";
import { formatAppDate } from "@/lib/dates/timezone";
import type { EventWithCalendar } from "@/lib/data/events";
import { EmptyState } from "@/components/forms/ui";

type CalendarShellProps = {
  timezone: string;
  weekStartsOn: 0 | 1;
  initialView: CalendarViewId;
  initialDate: string;
  visibleStartHour: number;
  visibleEndHour: number;
  initialFilters: CalendarFilterPrefs;
  initialEvents: EventInput[];
  initialEventRecords: EventWithCalendar[];
  initialShelfTasks?: ShelfEligibleTask[];
};

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function CalendarShell({
  timezone,
  weekStartsOn,
  initialView,
  initialDate,
  visibleStartHour,
  visibleEndHour,
  initialFilters,
  initialEvents,
  initialEventRecords,
  initialShelfTasks = [],
}: CalendarShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarRef = useRef<FullCalendar>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  const [currentView, setCurrentView] = useState<CalendarViewId>(initialView);
  const [anchorDate, setAnchorDate] = useState(initialDate);
  const [rangeLabel, setRangeLabel] = useState("");
  const [filters, setFilters] = useState<CalendarFilterPrefs>(initialFilters);
  const [events, setEvents] = useState<EventInput[]>(initialEvents);
  const [eventRecords, setEventRecords] = useState<EventWithCalendar[]>(initialEventRecords);
  const [selectedEvent, setSelectedEvent] = useState<EventWithCalendar | null>(null);
  const [selectedProps, setSelectedProps] =
    useState<CalendarRenderEventExtendedProps | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  const eventRecordMap = useMemo(
    () => new Map(eventRecords.map((e) => [e.id, e])),
    [eventRecords],
  );

  const updateUrl = useCallback(
    (view: CalendarViewId, date: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", view);
      params.set("date", date);
      router.replace(`/calendar?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const fetchEvents = useCallback(
    (start: string, end: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      listEventsInRangeAction({ start, end, filters })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result.success && result.data) {
            setEvents(result.data.events);
            setEventRecords(result.data.eventRecords);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [filters],
  );

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const view = fullCalendarViewToCalendarView(arg.view.type);
      setCurrentView(view);
      setRangeLabel(arg.view.title);
      const dateKey = arg.startStr.slice(0, 10);
      setAnchorDate(dateKey);
      updateUrl(view, dateKey);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchEvents(arg.startStr, arg.endStr);
      }, 150);
    },
    [fetchEvents, updateUrl],
  );

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const range = api.view;
    fetchEvents(range.activeStart.toISOString(), range.activeEnd.toISOString());
  }, [filters, fetchEvents]);

  const handleViewChange = (view: CalendarViewId) => {
    const api = calendarRef.current?.getApi();
    api?.changeView(calendarViewToFullCalendar(view));
    setCurrentView(view);
    startTransition(() => {
      saveCalendarViewPreferenceAction({ view, isMobile });
    });
  };

  const handleFilterChange = (next: CalendarFilterPrefs) => {
    setFilters(next);
    startTransition(() => {
      saveCalendarFilterPrefsAction(next);
    });
  };

  const handleEventClick = (info: EventClickArg) => {
    const record = eventRecordMap.get(info.event.id);
    const props = info.event.extendedProps as CalendarRenderEventExtendedProps;
    if (record) {
      setSelectedEvent(record);
      setSelectedProps(props);
    }
  };

  const [mutationError, setMutationError] = useState<{
    message: string;
    workflowUrl?: string | null;
  } | null>(null);

  const revertMutation = (revert: () => void) => {
    revert();
  };

  const handleMutationFailure = (
    result: { error: string; workflowUrl?: string | null },
    revert: () => void,
  ) => {
    revertMutation(revert);
    setMutationError({
      message: result.error,
      workflowUrl: result.workflowUrl,
    });
  };

  const handleEventReceive = (info: { event: EventApi; revert: () => void }) => {
    const taskId = info.event.extendedProps.shelfTaskId as string | undefined;
    if (!taskId) {
      info.revert();
      return;
    }

    const revert = info.revert;
    startTransition(async () => {
      const result = await scheduleTaskFromShelfAction({
        taskId,
        startAt: info.event.start!.toISOString(),
        endAt: info.event.end!.toISOString(),
      });

      if (!result.success) {
        handleMutationFailure(result, revert);
        return;
      }

      info.event.remove();
      setMutationError(null);
      setShelfMessage(`Created planning proposal. Accept it from Today or Week.`);
      router.refresh();
    });
  };

  const [shelfMessage, setShelfMessage] = useState<string | null>(null);

  const handleEventDrop = (info: EventDropArg) => {
    const revert = info.revert;
    startTransition(async () => {
      const result = await moveCalendarEventAction({
        eventId: info.event.id,
        startAt: info.event.start!.toISOString(),
        endAt: info.event.end!.toISOString(),
      });
      if (!result.success) {
        handleMutationFailure(result, revert);
      } else {
        setMutationError(null);
        router.refresh();
      }
    });
  };

  const handleEventResize = (info: EventResizeDoneArg) => {
    const revert = info.revert;
    startTransition(async () => {
      const result = await moveCalendarEventAction({
        eventId: info.event.id,
        startAt: info.event.start!.toISOString(),
        endAt: info.event.end!.toISOString(),
      });
      if (!result.success) {
        handleMutationFailure(result, revert);
      } else {
        setMutationError(null);
        router.refresh();
      }
    });
  };

  const handleDateSelect = (info: DateSelectArg) => {
    const startDate = info.startStr.slice(0, 10);
    const params = new URLSearchParams();
    params.set("date", startDate);
    if (!info.allDay) {
      const startTime = info.startStr.includes("T")
        ? info.startStr.slice(11, 16)
        : "09:00";
      const endTime = info.endStr.includes("T")
        ? info.endStr.slice(11, 16)
        : "10:00";
      params.set("startTime", startTime);
      params.set("endTime", endTime);
    }
    params.set("allDay", info.allDay ? "1" : "0");
    router.push(`/events/new?${params.toString()}`);
    info.view.calendar.unselect();
  };

  const scrollTime = useMemo(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
  }, []);

  return (
    <div className="lg:flex lg:gap-4">
      <div className="min-w-0 flex-1">
        <CalendarToolbar
          currentLabel={rangeLabel || formatAppDate(anchorDate)}
          currentView={currentView}
          anchorDate={anchorDate}
          onPrev={() => calendarRef.current?.getApi().prev()}
          onNext={() => calendarRef.current?.getApi().next()}
          onToday={() => calendarRef.current?.getApi().today()}
          onViewChange={handleViewChange}
          onDateChange={(dateKey) => {
            calendarRef.current?.getApi().gotoDate(dateKey);
            setAnchorDate(dateKey);
            updateUrl(currentView, dateKey);
          }}
        />

        <CalendarFilters filters={filters} onChange={handleFilterChange} />

        <div className="mb-3">
          <TaskShelf
            initialTasks={initialShelfTasks}
            onProposalCreated={() => {
              const api = calendarRef.current?.getApi();
              if (!api) return;
              const range = api.view;
              fetchEvents(
                range.activeStart.toISOString(),
                range.activeEnd.toISOString(),
              );
            }}
          />
        </div>

        {shelfMessage && (
          <p className="mb-3 text-sm text-muted" role="status">
            {shelfMessage}
          </p>
        )}

        {mutationError && (
          <div
            className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
            role="alert"
          >
            <p>{mutationError.message}</p>
            {mutationError.workflowUrl && (
              <Link
                href={mutationError.workflowUrl}
                className="mt-1 inline-block text-accent hover:underline"
              >
                Open workflow
              </Link>
            )}
          </div>
        )}

        {loading && (
          <p className="mb-2 text-xs text-muted" aria-live="polite">
            Loading events…
          </p>
        )}

        <div className="lifeos-calendar rounded-xl border border-border bg-surface p-2">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={calendarViewToFullCalendar(initialView)}
            initialDate={initialDate}
            timeZone={timezone}
            firstDay={weekStartsOn}
            headerToolbar={false}
            height="auto"
            events={events}
            editable
            droppable
            selectable
            selectMirror
            nowIndicator
            scrollTime={scrollTime}
            slotMinTime={formatHourForSlot(visibleStartHour)}
            slotMaxTime={formatHourForSlot(visibleEndHour)}
            allDaySlot
            dayMaxEvents={3}
            eventMinHeight={20}
            views={{
              timeGridThreeDay: {
                type: "timeGrid",
                duration: { days: 3 },
              },
            }}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventReceive={handleEventReceive}
            eventResize={handleEventResize}
            select={handleDateSelect}
            moreLinkClick="day"
            eventTimeFormat={{
              hour: "numeric",
              minute: "2-digit",
              meridiem: "short",
            }}
          />
        </div>

        {!loading && events.length === 0 && (
          <EmptyState message="No events in this range match your filters." />
        )}
      </div>

      {selectedEvent && (
        <EventInspector
          event={selectedEvent}
          extendedProps={selectedProps}
          onClose={() => {
            setSelectedEvent(null);
            setSelectedProps(null);
          }}
        />
      )}
    </div>
  );
}
