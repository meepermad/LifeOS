import { DatabaseError, ConflictError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getWorkCalendar } from "@/lib/data/calendars";
import type { EventWithCalendar } from "@/lib/data/events";
import type { EventRow } from "@/types/domain";
import { listEventsInRange } from "@/lib/data/events";
import type { ParsedShift } from "@/lib/work/shift-validation";
import { splitDateTimeForForm } from "@/lib/dates/timezone";
import { buildShiftExternalId } from "@/lib/work/shift-reconciliation";
import type { ShiftReconciliationItem } from "@/lib/work/shift-reconciliation";

export async function listWorkShiftsInRange(
  start: string,
  end: string,
): Promise<EventWithCalendar[]> {
  const workCalendar = await getWorkCalendar();
  if (!workCalendar) return [];

  const events = await listEventsInRange(start, end);
  return events.filter(
    (event) =>
      event.calendar_id === workCalendar.id &&
      event.event_type === "work" &&
      event.status !== "cancelled",
  );
}

async function upsertWorkShift(
  shift: ParsedShift,
  calendarId: string,
  options?: { assistantActionId?: string; createdByAssistant?: boolean },
): Promise<EventRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const externalEventId = buildShiftExternalId(shift.dateKey);

  const payload = {
    user_id: user.id,
    calendar_id: calendarId,
    external_event_id: externalEventId,
    title: shift.title,
    location: shift.location,
    shift_note: shift.note,
    shift_source_label: null as string | null,
    start_at: shift.startAt,
    end_at: shift.endAt,
    all_day: false,
    status: "confirmed" as const,
    source: "manual" as const,
    event_type: "work" as const,
    is_read_only: false,
    blocks_time: true,
    unpaid_break_minutes: shift.unpaidBreakMinutes,
    created_by_assistant: options?.createdByAssistant ?? false,
    assistant_action_id: options?.assistantActionId ?? null,
  };

  if (shift.eventId) {
    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", shift.eventId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to update work shift");
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
      throw new DatabaseError("Failed to update work shift");
    }
    return data;
  }

  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create work shift");
  }

  return data;
}

async function cancelWorkShift(eventId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("events")
    .update({ status: "cancelled", blocks_time: false })
    .eq("id", eventId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to remove work shift");
  }
}

export async function applyWorkShiftReconciliation(
  items: ShiftReconciliationItem[],
  options?: { assistantActionId?: string; createdByAssistant?: boolean },
): Promise<{ created: number; updated: number; unchanged: number; removed: number }> {
  const workCalendar = await getWorkCalendar();
  if (!workCalendar) {
    throw new ConflictError("Work calendar not found");
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
      await cancelWorkShift(item.eventId);
      removed += 1;
      continue;
    }
    if (!item.shift) continue;

    if (item.action === "created") {
      await upsertWorkShift(item.shift, workCalendar.id, options);
      created += 1;
    } else if (item.action === "updated") {
      await upsertWorkShift(item.shift, workCalendar.id, options);
      updated += 1;
    }
  }

  return { created, updated, unchanged, removed };
}

export async function cancelWorkShiftByDate(dateKey: string): Promise<boolean> {
  const workCalendar = await getWorkCalendar();
  if (!workCalendar) return false;

  const user = await requireAllowedUser();
  const supabase = await createClient();
  const externalEventId = buildShiftExternalId(dateKey);

  const { data } = await supabase
    .from("events")
    .select("id")
    .eq("calendar_id", workCalendar.id)
    .eq("external_event_id", externalEventId)
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (!data) return false;
  await cancelWorkShift(data.id);
  return true;
}

export function eventToShiftDayDraft(event: EventWithCalendar): {
  dateKey: string;
  isOff: false;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  location: string;
  note: string;
  eventId: string;
} {
  const start = splitDateTimeForForm(event.start_at);
  const end = splitDateTimeForForm(event.end_at);
  return {
    dateKey:
      event.external_event_id?.replace("work-shift:", "") ?? start.date,
    isOff: false,
    startTime: start.time,
    endTime: end.time,
    unpaidBreakMinutes: event.unpaid_break_minutes ?? 0,
    location: event.location ?? "",
    note: event.shift_note ?? "",
    eventId: event.id,
  };
}
