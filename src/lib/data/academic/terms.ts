import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { AcademicTermRow } from "@/types/domain";

export async function listAcademicTerms(): Promise<AcademicTermRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_terms")
    .select("*")
    .eq("user_id", user.id)
    .order("classes_start", { ascending: false });

  if (error) {
    throw new DatabaseError("Failed to load academic terms");
  }

  return data ?? [];
}

export async function getAcademicTermById(
  termId: string,
): Promise<AcademicTermRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_terms")
    .select("*")
    .eq("id", termId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load academic term");
  }

  return data;
}

export async function createAcademicTerm(
  input: Omit<AcademicTermRow, "id" | "user_id" | "created_at" | "updated_at">,
): Promise<AcademicTermRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_terms")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create academic term");
  }

  return data;
}

export async function updateAcademicTerm(
  termId: string,
  input: Partial<AcademicTermRow>,
): Promise<AcademicTermRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("academic_terms")
    .update(input)
    .eq("id", termId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update academic term");
  }

  return data;
}

export async function archiveAcademicTerm(termId: string): Promise<void> {
  await updateAcademicTerm(termId, { status: "archived" });
}

export async function setActiveAcademicTerm(termId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("academic_terms")
    .update({ status: "draft" })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (clearError) {
    throw new DatabaseError("Failed to clear active academic term");
  }

  await updateAcademicTerm(termId, { status: "active" });
}
