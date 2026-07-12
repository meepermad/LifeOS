"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createEventAction,
  updateEventAction,
} from "@/lib/actions/events";
import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/constants";
import type { EventFormInput } from "@/lib/validation/events";
import type { CalendarRow, EventRow } from "@/types/domain";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
  selectClassName,
  textareaClassName,
} from "@/components/forms/ui";
import { splitDateTimeForForm } from "@/lib/dates/timezone";

type EventFormProps = {
  calendars: CalendarRow[];
  event?: EventRow;
  defaultCalendarId?: string;
  cancelHref: string;
};

export function EventForm({
  calendars,
  event,
  defaultCalendarId,
  cancelHref,
}: EventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const initial = event
    ? {
        ...splitDateTimeForForm(event.start_at),
        endTime: splitDateTimeForForm(event.end_at).time,
      }
    : null;

  const [allDay, setAllDay] = useState(event?.all_day ?? false);

  function handleSubmit(formData: FormData) {
    const input: EventFormInput = {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      location: String(formData.get("location") ?? ""),
      calendarId: String(formData.get("calendarId") ?? ""),
      eventType: String(formData.get("eventType") ?? "other") as EventFormInput["eventType"],
      status: String(formData.get("status") ?? "confirmed") as EventFormInput["status"],
      allDay,
      date: String(formData.get("date") ?? ""),
      startTime: String(formData.get("startTime") ?? "") || undefined,
      endTime: String(formData.get("endTime") ?? "") || undefined,
    };

    startTransition(async () => {
      setFormError(null);
      setFieldErrors({});

      const result = event
        ? await updateEventAction(event.id, input)
        : await createEventAction(input);

      if (!result.success) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      router.push(cancelHref);
      router.refresh();
    });
  }

  const writableCalendars = calendars.filter((calendar) => calendar.is_writable);

  return (
    <form action={handleSubmit} className="space-y-4">
      <FormField label="Title" htmlFor="title" error={fieldErrors.title}>
        <input
          id="title"
          name="title"
          required
          defaultValue={event?.title ?? ""}
          className={inputClassName}
        />
      </FormField>

      <FormField label="Calendar" htmlFor="calendarId" error={fieldErrors.calendarId}>
        <select
          id="calendarId"
          name="calendarId"
          defaultValue={event?.calendar_id ?? defaultCalendarId ?? writableCalendars[0]?.id}
          className={selectClassName}
        >
          {writableCalendars.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Event type" htmlFor="eventType">
        <select
          id="eventType"
          name="eventType"
          defaultValue={event?.event_type ?? "other"}
          className={selectClassName}
        >
          {EVENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Status" htmlFor="status">
        <select
          id="status"
          name="status"
          defaultValue={event?.status ?? "confirmed"}
          className={selectClassName}
        >
          {EVENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Date" htmlFor="date" error={fieldErrors.date}>
        <input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={initial?.date ?? ""}
          className={inputClassName}
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        All day
      </label>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start" htmlFor="startTime" error={fieldErrors.startTime}>
            <input
              id="startTime"
              name="startTime"
              type="time"
              required
              defaultValue={initial?.time ?? ""}
              className={inputClassName}
            />
          </FormField>
          <FormField label="End" htmlFor="endTime" error={fieldErrors.endTime}>
            <input
              id="endTime"
              name="endTime"
              type="time"
              required
              defaultValue={initial?.endTime ?? ""}
              className={inputClassName}
            />
          </FormField>
        </div>
      )}

      <FormField label="Location" htmlFor="location">
        <input
          id="location"
          name="location"
          defaultValue={event?.location ?? ""}
          className={inputClassName}
        />
      </FormField>

      <FormField label="Description" htmlFor="description">
        <textarea
          id="description"
          name="description"
          defaultValue={event?.description ?? ""}
          className={textareaClassName}
        />
      </FormField>

      {formError && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {formError}
        </p>
      )}

      <PrimaryButton type="submit" loading={isPending}>
        {event ? "Save event" : "Create event"}
      </PrimaryButton>

      <SecondaryButton type="button" onClick={() => router.push(cancelHref)}>
        Cancel
      </SecondaryButton>
    </form>
  );
}
