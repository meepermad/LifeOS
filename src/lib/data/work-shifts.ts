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
import type { ShiftSlotDraft } from "@/lib/work/shift-draft";

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
  const externalEventId = buildShiftExternalId(shift.externalEventId);

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
    work_profile_id: shift.workProfileId ?? null,
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
  const { data } = await supabase
    .from("events")
    .select("id")
    .eq("calendar_id", workCalendar.id)
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .gte("start_at", `${dateKey}T00:00:00.000Z`)
    .lt("start_at", `${dateKey}T23:59:59.999Z`)
    .limit(2);

  if (!data?.length) return false;
  if (data.length > 1) {
    throw new ConflictError("More than one shift exists on that date. Please specify which shift.");
  }
  await cancelWorkShift(data[0]!.id);
  return true;
}

export function eventToShiftSlotDraft(event: EventWithCalendar): ShiftSlotDraft {
  const start = splitDateTimeForForm(event.start_at);
  const end = splitDateTimeForForm(event.end_at);
  return {
    clientId: crypto.randomUUID(),
    dateKey: start.date,
    startTime: start.time,
    endTime: end.time,
    unpaidBreakMinutes: event.unpaid_break_minutes ?? 0,
    location: event.location ?? "",
    note: event.shift_note ?? "",
    eventId: event.id,
    workProfileId: event.work_profile_id,
    externalEventId: event.external_event_id ?? undefined,
    displayTitle: event.title,
  };
}

/** @deprecated Use `eventToShiftSlotDraft`. */
export const eventToShiftDayDraft = eventToShiftSlotDraft;

export async function listUnassignedWorkShifts(): Promise<EventWithCalendar[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const workCalendar = await getWorkCalendar();
  if (!workCalendar) return [];
  const { data, error } = await supabase
    .from("events")
    .select("*, calendars!inner(name, source)")
    .eq("user_id", user.id)
    .eq("calendar_id", workCalendar.id)
    .eq("event_type", "work")
    .neq("status", "cancelled")
    .is("work_profile_id", null);
  if (error) throw new DatabaseError("Failed to load unassigned work shifts");
  return (data ?? []).map((event) => ({
    ...event,
    calendar_name: event.calendars.name,
    calendar_source: event.calendars.source,
  }));
}

export async function countUnassignedWorkShifts(): Promise<number> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const workCalendar = await getWorkCalendar();
  if (!workCalendar) return 0;
  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("calendar_id", workCalendar.id)
    .eq("event_type", "work")
    .neq("status", "cancelled")
    .is("work_profile_id", null);
  if (error) throw new DatabaseError("Failed to count unassigned work shifts");
  return count ?? 0;
}

export async function assignWorkProfileToShifts(
  ids: string[],
  profileId: string,
): Promise<number> {
  if (!ids.length) return 0;
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ work_profile_id: profileId })
    .eq("user_id", user.id)
    .in("id", ids)
    .select("id");
  if (error) throw new DatabaseError("Failed to assign work profile");
  return data?.length ?? 0;
}
