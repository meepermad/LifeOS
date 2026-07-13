import {
  ConflictError,
  DatabaseError,
} from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getCalendarById } from "@/lib/data/calendars";
import type { ParsedEventTimes } from "@/lib/validation/events";
import type { NormalizedCanvasEvent } from "@/lib/integrations/canvas/schemas";
import type { EventRow } from "@/types/domain";
import { defaultBlocksTimeForEventType, toPlanningEvent } from "@/lib/planning/mappers";

export type EventWithCalendar = EventRow & {
  calendar_name: string;
  calendar_source: string;
};

export type CreateEventOptions = {
  createdByAssistant?: boolean;
  assistantActionId?: string;
};

function isBlockingOverlapEvent(event: ReturnType<typeof toPlanningEvent>): boolean {
  if (event.status === "cancelled" || event.status === "tentative") {
    return false;
  }
  if (event.eventType === "deadline" || !event.blocksTime) {
    return false;
  }
  return true;
}

export async function assertNoBlockingOverlap(
  startAt: string,
  endAt: string,
): Promise<void> {
  const events = await listEventsInRange(startAt, endAt);
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();

  for (const event of events) {
    const planningEvent = toPlanningEvent(event);
    if (!isBlockingOverlapEvent(planningEvent)) continue;
    const eventStart = new Date(event.start_at).getTime();
    const eventEnd = new Date(event.end_at).getTime();
    if (eventStart < endMs && eventEnd > startMs) {
      throw new ConflictError(
        "This time conflicts with an existing calendar event.",
      );
    }
  }
}

async function assertWritableEvent(
  event: EventRow,
  calendarId?: string,
): Promise<void> {
  if (event.is_read_only) {
    throw new ConflictError("Read-only events cannot be modified");
  }

  if (calendarId) {
    const calendar = await getCalendarById(calendarId);
    if (!calendar.is_writable) {
      throw new ConflictError("Selected calendar is not writable");
    }
  }
}

export type ListEventsInRangeOptions = {
  includeCancelled?: boolean;
};

export async function listEventsInRange(
  start: string,
  end: string,
  options?: ListEventsInRangeOptions,
): Promise<EventWithCalendar[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: calendars, error: calendarsError } = await supabase
    .from("calendars")
    .select("id, name, source, is_visible")
    .eq("user_id", user.id)
    .eq("is_visible", true);

  if (calendarsError) {
    throw new DatabaseError("Failed to load calendars");
  }

  const visibleCalendarIds = (calendars ?? []).map((calendar) => calendar.id);
  if (visibleCalendarIds.length === 0) {
    return [];
  }

  const calendarMap = new Map(
    (calendars ?? []).map((calendar) => [calendar.id, calendar]),
  );

  let query = supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .in("calendar_id", visibleCalendarIds)
    .lt("start_at", end)
    .gt("end_at", start);

  if (!options?.includeCancelled) {
    query = query.neq("status", "cancelled");
  }

  const { data, error } = await query.order("start_at", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load events");
  }

  return (data ?? []).map((event) => {
    const calendar = calendarMap.get(event.calendar_id)!;
    return {
      ...event,
      calendar_name: calendar.name,
      calendar_source: calendar.source,
    };
  });
}

export async function getEventById(eventId: string): Promise<EventWithCalendar> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new DatabaseError("Event not found");
  }

  const calendar = await getCalendarById(data.calendar_id);

  return {
    ...data,
    calendar_name: calendar.name,
    calendar_source: calendar.source,
  };
}

export async function createEvent(
  input: ParsedEventTimes,
  options?: CreateEventOptions,
): Promise<EventRow> {
  const user = await requireAllowedUser();
  const calendar = await getCalendarById(input.calendarId);

  if (!calendar.is_writable) {
    throw new ConflictError("Selected calendar is not writable");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: user.id,
      calendar_id: input.calendarId,
      title: input.title,
      description: input.description,
      location: input.location,
      start_at: input.startAt,
      end_at: input.endAt,
      all_day: input.allDay,
      status: input.status,
      source: "manual",
      event_type: input.eventType,
      is_read_only: false,
      blocks_time: defaultBlocksTimeForEventType(input.eventType),
      created_by_assistant: options?.createdByAssistant ?? false,
      assistant_action_id: options?.assistantActionId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create event");
  }

  return data;
}

export async function updateEvent(
  eventId: string,
  input: ParsedEventTimes,
): Promise<EventRow> {
  const user = await requireAllowedUser();
  const existing = await getEventById(eventId);
  await assertWritableEvent(existing, input.calendarId);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .update({
      calendar_id: input.calendarId,
      title: input.title,
      description: input.description,
      location: input.location,
      start_at: input.startAt,
      end_at: input.endAt,
      all_day: input.allDay,
      status: input.status,
      event_type: input.eventType,
      blocks_time: defaultBlocksTimeForEventType(input.eventType),
    })
    .eq("id", eventId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update event");
  }

  return data;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const user = await requireAllowedUser();
  const existing = await getEventById(eventId);
  await assertWritableEvent(existing);

  const supabase = await createClient();

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete event");
  }
}

export type CanvasUpsertResult = "created" | "updated" | "unchanged";

export async function upsertCanvasEvent(
  calendarId: string,
  event: NormalizedCanvasEvent,
): Promise<CanvasUpsertResult> {
  const user = await requireAllowedUser();
  const calendar = await getCalendarById(calendarId);

  if (calendar.source !== "canvas" || calendar.user_id !== user.id) {
    throw new ConflictError("Canvas events may only be written to the Canvas calendar");
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select("*")
    .eq("calendar_id", calendarId)
    .eq("external_event_id", event.externalEventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    throw new DatabaseError("Failed to load existing Canvas event");
  }

  const payload = {
    user_id: user.id,
    calendar_id: calendarId,
    external_event_id: event.externalEventId,
    title: event.title,
    description: event.description,
    location: event.location,
    start_at: event.startAt,
    end_at: event.endAt,
    all_day: event.allDay,
    status: event.status,
    source: "canvas" as const,
    event_type: event.eventType,
    is_read_only: true,
    blocks_time: defaultBlocksTimeForEventType(event.eventType),
    created_by_assistant: false,
    external_updated_at: event.externalUpdatedAt,
    content_hash: event.contentHash,
  };

  if (!existing) {
    const { error } = await supabase.from("events").insert(payload);
    if (error) {
      throw new DatabaseError("Failed to create Canvas event");
    }
    return "created";
  }

  if (existing.content_hash === event.contentHash) {
    return "unchanged";
  }

  const { error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", existing.id)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to update Canvas event");
  }

  return "updated";
}

export async function cancelCanvasEventsNotInSet(input: {
  calendarId: string;
  seenExternalIds: string[];
  windowStart: string;
  windowEnd: string;
}): Promise<{ count: number; eventIds: string[] }> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, external_event_id, status, event_type")
    .eq("user_id", user.id)
    .eq("calendar_id", input.calendarId)
    .eq("source", "canvas")
    .gte("start_at", input.windowStart)
    .lte("start_at", input.windowEnd)
    .not("external_event_id", "is", null);

  if (error) {
    throw new DatabaseError("Failed to load Canvas events for reconciliation");
  }

  const seen = new Set(input.seenExternalIds);
  const toCancel = (events ?? []).filter(
    (event) =>
      event.external_event_id &&
      !seen.has(event.external_event_id) &&
      event.status !== "cancelled",
  );

  if (toCancel.length === 0) {
    return { count: 0, eventIds: [] };
  }

  const eventIds = toCancel.map((event) => event.id);

  const { error: updateError } = await supabase
    .from("events")
    .update({ status: "cancelled" })
    .in("id", eventIds)
    .eq("user_id", user.id);

  if (updateError) {
    throw new DatabaseError("Failed to cancel removed Canvas events");
  }

  const deadlineEventIds = toCancel
    .filter((event) => event.event_type === "deadline")
    .map((event) => event.id);

  return { count: toCancel.length, eventIds: deadlineEventIds };
}

export type CanvasEventForSync = {
  id: string;
  external_event_id: string;
  title: string;
  description: string | null;
  end_at: string;
  status: string;
  event_type: string;
};

export async function listCanvasEventsByExternalIds(
  calendarId: string,
  externalIds: string[],
): Promise<CanvasEventForSync[]> {
  if (externalIds.length === 0) {
    return [];
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("id, external_event_id, title, description, end_at, status, event_type")
    .eq("user_id", user.id)
    .eq("calendar_id", calendarId)
    .eq("source", "canvas")
    .in("external_event_id", externalIds);

  if (error) {
    throw new DatabaseError("Failed to load Canvas events for task sync");
  }

  return (data ?? []).filter(
    (event): event is CanvasEventForSync =>
      event.external_event_id != null && event.event_type === "deadline",
  );
}

export async function listCancelledCanvasDeadlineEvents(
  calendarId: string,
  externalIds: string[],
): Promise<Array<{ id: string; external_event_id: string; status: string }>> {
  if (externalIds.length === 0) {
    return [];
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("id, external_event_id, status")
    .eq("user_id", user.id)
    .eq("calendar_id", calendarId)
    .eq("source", "canvas")
    .eq("event_type", "deadline")
    .eq("status", "cancelled")
    .in("external_event_id", externalIds);

  if (error) {
    throw new DatabaseError("Failed to load cancelled Canvas deadline events");
  }

  return (data ?? []).filter(
    (event): event is { id: string; external_event_id: string; status: string } =>
      event.external_event_id != null,
  );
}

export async function listTodayEvents(): Promise<EventWithCalendar[]> {
  const { getTodayBoundsUtc } = await import("@/lib/dates/timezone");
  const bounds = getTodayBoundsUtc();
  return listEventsInRange(bounds.start.toISOString(), bounds.end.toISOString());
}

export async function getNextUpcomingEvent(): Promise<EventWithCalendar | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: calendars, error: calendarsError } = await supabase
    .from("calendars")
    .select("id, name, source")
    .eq("user_id", user.id)
    .eq("is_visible", true);

  if (calendarsError) {
    throw new DatabaseError("Failed to load calendars");
  }

  const visibleCalendarIds = (calendars ?? []).map((calendar) => calendar.id);
  if (visibleCalendarIds.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .in("calendar_id", visibleCalendarIds)
    .gte("end_at", now)
    .neq("status", "cancelled")
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load next event");
  }

  if (!data) return null;

  const calendar = (calendars ?? []).find((item) => item.id === data.calendar_id);
  if (!calendar) return null;

  return {
    ...data,
    calendar_name: calendar.name,
    calendar_source: calendar.source,
  };
}
