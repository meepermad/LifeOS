import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { CourseRow } from "@/types/domain";

export async function listCoursesForTerm(
  termId: string,
): Promise<CourseRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("academic_term_id", termId)
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    throw new DatabaseError("Failed to load courses");
  }

  return data ?? [];
}

export async function createCourse(
  input: Omit<CourseRow, "id" | "user_id" | "created_at" | "updated_at">,
): Promise<CourseRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create course");
  }

  return data;
}

export async function updateCourse(
  courseId: string,
  input: Partial<CourseRow>,
): Promise<CourseRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .update(input)
    .eq("id", courseId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update course");
  }

  return data;
}

export async function deleteCourse(courseId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete course");
  }
}
