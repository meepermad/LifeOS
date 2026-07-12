import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { ClassMeetingRow } from "@/types/domain";

export async function listMeetingsForTerm(
  termId: string,
): Promise<ClassMeetingRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id")
    .eq("academic_term_id", termId)
    .eq("user_id", user.id);

  if (coursesError) {
    throw new DatabaseError("Failed to load courses for meetings");
  }

  const courseIds = (courses ?? []).map((course) => course.id);
  if (courseIds.length === 0) return [];

  const { data, error } = await supabase
    .from("class_meetings")
    .select("*")
    .in("course_id", courseIds)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to load class meetings");
  }

  return data ?? [];
}

export async function listMeetingsForCourse(
  courseId: string,
): Promise<ClassMeetingRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_meetings")
    .select("*")
    .eq("course_id", courseId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to load class meetings");
  }

  return data ?? [];
}

export async function createClassMeeting(
  input: Omit<ClassMeetingRow, "id" | "user_id" | "created_at" | "updated_at">,
): Promise<ClassMeetingRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_meetings")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create class meeting");
  }

  return data;
}

export async function updateClassMeeting(
  meetingId: string,
  input: Partial<ClassMeetingRow>,
): Promise<ClassMeetingRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_meetings")
    .update(input)
    .eq("id", meetingId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update class meeting");
  }

  return data;
}

export async function deleteClassMeeting(meetingId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_meetings")
    .delete()
    .eq("id", meetingId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete class meeting");
  }
}

export async function listLinkedCanvasUids(): Promise<Set<string>> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_meetings")
    .select("source_canvas_uid")
    .eq("user_id", user.id)
    .not("source_canvas_uid", "is", null);

  if (error) {
    throw new DatabaseError("Failed to load linked canvas uids");
  }

  return new Set(
    (data ?? [])
      .map((row) => row.source_canvas_uid)
      .filter((uid): uid is string => Boolean(uid)),
  );
}
