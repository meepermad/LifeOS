import { DatabaseError } from "@/lib/errors/app-error";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventWithCalendar } from "@/lib/data/events";
import type { AcademicTermRow, ClassMeetingRow, TaskRow } from "@/types/domain";

export async function listEventsInRangeForUser(
  userId: string,
  start: string,
  end: string,
): Promise<EventWithCalendar[]> {
  const admin = createAdminClient();

  const { data: calendars, error: calendarsError } = await admin
    .from("calendars")
    .select("id, name, source, is_visible")
    .eq("user_id", userId)
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

  const { data, error } = await admin
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .in("calendar_id", visibleCalendarIds)
    .lt("start_at", end)
    .gt("end_at", start)
    .neq("status", "cancelled")
    .order("start_at", { ascending: true });

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

export async function listTasksForUser(
  userId: string,
  options?: { status?: "active" | "completed" | "all" },
): Promise<TaskRow[]> {
  const admin = createAdminClient();
  let query = admin.from("tasks").select("*").eq("user_id", userId);
  if (options?.status === "active") {
    query = query.eq("status", "active");
  }
  const { data, error } = await query.order("due_at", { ascending: true });
  if (error) {
    throw new DatabaseError("Failed to load tasks");
  }
  return data ?? [];
}

export async function listAcademicTermsForUser(
  userId: string,
): Promise<AcademicTermRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("academic_terms")
    .select("*")
    .eq("user_id", userId)
    .order("classes_start", { ascending: true });
  if (error) {
    throw new DatabaseError("Failed to load academic terms");
  }
  return data ?? [];
}

export async function listMeetingsForTermForUser(
  userId: string,
  termId: string,
): Promise<ClassMeetingRow[]> {
  const admin = createAdminClient();
  const { data: courses, error: coursesError } = await admin
    .from("courses")
    .select("id")
    .eq("academic_term_id", termId)
    .eq("user_id", userId);
  if (coursesError) {
    throw new DatabaseError("Failed to load courses for meetings");
  }
  const courseIds = (courses ?? []).map((course) => course.id);
  if (courseIds.length === 0) return [];
  const { data, error } = await admin
    .from("class_meetings")
    .select("*")
    .in("course_id", courseIds)
    .eq("user_id", userId);
  if (error) {
    throw new DatabaseError("Failed to load class meetings");
  }
  return data ?? [];
}

export async function listCoursesForTermForUser(
  userId: string,
  termId: string,
): Promise<import("@/types/domain").CourseRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("courses")
    .select("*")
    .eq("academic_term_id", termId)
    .eq("user_id", userId);
  if (error) {
    throw new DatabaseError("Failed to load courses");
  }
  return data ?? [];
}
