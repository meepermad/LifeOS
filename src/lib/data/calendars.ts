import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { CalendarRow } from "@/types/domain";

export async function listCalendars(): Promise<CalendarRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    throw new DatabaseError("Failed to load calendars");
  }

  return data ?? [];
}

export async function listWritableCalendars(): Promise<CalendarRow[]> {
  const calendars = await listCalendars();
  return calendars.filter((calendar) => calendar.is_writable);
}

export async function getCalendarById(calendarId: string): Promise<CalendarRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("*")
    .eq("id", calendarId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new DatabaseError("Calendar not found");
  }

  return data;
}

export async function updateCalendarVisibility(
  calendarId: string,
  isVisible: boolean,
): Promise<CalendarRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calendars")
    .update({ is_visible: isVisible })
    .eq("id", calendarId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update calendar visibility");
  }

  return data;
}

export async function getManualCalendar(): Promise<CalendarRow | null> {
  const calendars = await listCalendars();
  return calendars.find((calendar) => calendar.name === "Manual") ?? null;
}

export async function getLifeOSPlanningCalendar(): Promise<CalendarRow | null> {
  const calendars = await listCalendars();
  return (
    calendars.find(
      (calendar) =>
        calendar.name === "LifeOS Planning" && calendar.source === "lifeos",
    ) ?? null
  );
}

export async function getWorkCalendar(): Promise<CalendarRow | null> {
  const calendars = await listCalendars();
  return calendars.find((calendar) => calendar.name === "Work") ?? null;
}

export async function getCanvasCalendar(): Promise<CalendarRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("*")
    .eq("user_id", user.id)
    .eq("source", "canvas")
    .eq("name", "Canvas")
    .single();

  if (error || !data) {
    throw new DatabaseError("Canvas calendar not found");
  }

  return data;
}

export async function linkCalendarToConnection(
  calendarId: string,
  connectionId: string,
): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("calendars")
    .update({ connection_id: connectionId })
    .eq("id", calendarId)
    .eq("user_id", user.id)
    .eq("source", "canvas");

  if (error) {
    throw new DatabaseError("Failed to link Canvas calendar to connection");
  }
}
