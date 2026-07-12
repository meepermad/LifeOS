import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { AcademicExceptionRow } from "@/types/domain";

export async function listExceptionsForTerm(
  termId: string,
): Promise<AcademicExceptionRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_exceptions")
    .select("*")
    .eq("academic_term_id", termId)
    .eq("user_id", user.id)
    .order("start_date");

  if (error) {
    throw new DatabaseError("Failed to load academic exceptions");
  }

  return data ?? [];
}

export async function createAcademicException(
  input: Omit<
    AcademicExceptionRow,
    "id" | "user_id" | "created_at" | "updated_at"
  >,
): Promise<AcademicExceptionRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_exceptions")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create academic exception");
  }

  return data;
}

export async function updateAcademicException(
  exceptionId: string,
  input: Partial<AcademicExceptionRow>,
): Promise<AcademicExceptionRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_exceptions")
    .update({ ...input, is_user_modified: true })
    .eq("id", exceptionId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update academic exception");
  }

  return data;
}

export async function deleteAcademicException(
  exceptionId: string,
): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("academic_exceptions")
    .delete()
    .eq("id", exceptionId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete academic exception");
  }
}

export async function insertPresetExceptions(
  termId: string,
  exceptions: Array<
    Omit<
      AcademicExceptionRow,
      "id" | "user_id" | "created_at" | "updated_at" | "academic_term_id" | "course_id"
    >
  >,
): Promise<number> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  if (exceptions.length === 0) return 0;

  const rows = exceptions.map((exception) => ({
    ...exception,
    academic_term_id: termId,
    user_id: user.id,
  }));

  const { error } = await supabase.from("academic_exceptions").insert(rows);
  if (error) {
    throw new DatabaseError("Failed to insert preset exceptions");
  }

  return rows.length;
}
