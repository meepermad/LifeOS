import { DatabaseError, ConflictError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getSchoolCalendar } from "@/lib/data/calendars";
import type { EventWithCalendar } from "@/lib/data/events";
import { listEventsInRange } from "@/lib/data/events";
import type { EventRow } from "@/types/domain";
import {
  buildAcademicExternalId,
  parseAcademicExternalId,
} from "@/lib/academic/meeting-expansion";
import type { ExpandedClassOccurrence } from "@/lib/academic/meeting-expansion";
import type { SemesterReconciliationItem } from "@/lib/academic/semester-reconciliation";

export async function listAcademicClassEventsInRange(
  start: string,
  end: string,
): Promise<EventWithCalendar[]> {
  const schoolCalendar = await getSchoolCalendar();
  if (!schoolCalendar) return [];

  const events = await listEventsInRange(start, end);
  return events.filter(
    (event) =>
      event.calendar_id === schoolCalendar.id &&
      event.source === "academic" &&
      event.event_type === "class" &&
      event.status !== "cancelled",
  );
}

export async function listAllAcademicClassEventsForTerm(
  termStart: string,
  termEnd: string,
  meetingIds?: string[],
): Promise<EventWithCalendar[]> {
  const events = await listAcademicClassEventsInRange(
    `${termStart}T00:00:00.000Z`,
    `${termEnd}T23:59:59.999Z`,
  );
  if (!meetingIds || meetingIds.length === 0) {
    return events;
  }
  const meetingIdSet = new Set(meetingIds);
  return events.filter(
    (event) =>
      event.class_meeting_id != null &&
      meetingIdSet.has(event.class_meeting_id),
  );
}

async function upsertClassOccurrence(
  occurrence: ExpandedClassOccurrence,
  calendarId: string,
  eventId?: string,
): Promise<EventRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const externalEventId = buildAcademicExternalId(
    occurrence.classMeetingId,
    occurrence.dateKey,
  );

  const payload = {
    user_id: user.id,
    calendar_id: calendarId,
    external_event_id: externalEventId,
    class_meeting_id: occurrence.classMeetingId,
    title: occurrence.title,
    location: occurrence.location,
    start_at: occurrence.startAt,
    end_at: occurrence.endAt,
    all_day: false,
    status: "confirmed" as const,
    source: "academic" as const,
    event_type: "class" as const,
    is_read_only: true,
    blocks_time: true,
    content_hash: occurrence.contentHash,
  };

  if (eventId) {
    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", eventId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to update class event");
    }
    return data;
  }

  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("calendar_id", calendarId)
    .eq("external_event_id", externalEventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to update class event");
    }
    return data;
  }

  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create class event");
  }

  return data;
}

async function cancelClassEvent(eventId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("events")
    .update({ status: "cancelled", blocks_time: false })
    .eq("id", eventId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to cancel class event");
  }
}

export async function applySemesterReconciliation(
  items: SemesterReconciliationItem[],
): Promise<{ created: number; updated: number; unchanged: number; removed: number }> {
  const schoolCalendar = await getSchoolCalendar();
  if (!schoolCalendar) {
    throw new ConflictError("School calendar not found");
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let removed = 0;

  for (const item of items) {
    if (item.action === "unchanged") {
      unchanged += 1;
      continue;
    }
    if (item.action === "removed" && item.eventId) {
      await cancelClassEvent(item.eventId);
      removed += 1;
      continue;
    }
    if (!item.occurrence) continue;

    if (item.action === "created") {
      await upsertClassOccurrence(item.occurrence, schoolCalendar.id);
      created += 1;
    } else if (item.action === "updated") {
      await upsertClassOccurrence(
        item.occurrence,
        schoolCalendar.id,
        item.eventId,
      );
      updated += 1;
    }
  }

  return { created, updated, unchanged, removed };
}

export function filterAcademicEvents(
  events: EventWithCalendar[],
): EventWithCalendar[] {
  return events.filter(
    (event) =>
      event.source === "academic" ||
      (event.external_event_id?.startsWith("academic:") ?? false),
  );
}

export { parseAcademicExternalId };
