import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { WorkShiftTemplateRow } from "@/types/domain";

export async function listWorkShiftTemplates(): Promise<WorkShiftTemplateRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_shift_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    throw new DatabaseError("Failed to load shift templates");
  }

  return data ?? [];
}

export async function createWorkShiftTemplate(input: {
  name: string;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes?: number;
  location?: string;
  label?: string;
}): Promise<WorkShiftTemplateRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_shift_templates")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      start_time: input.startTime,
      end_time: input.endTime,
      unpaid_break_minutes: input.unpaidBreakMinutes ?? 0,
      location: input.location?.trim() || null,
      label: input.label?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create shift template");
  }

  return data;
}

export async function updateWorkShiftTemplate(
  templateId: string,
  input: {
    name: string;
    startTime: string;
    endTime: string;
    unpaidBreakMinutes?: number;
    location?: string;
    label?: string;
  },
): Promise<WorkShiftTemplateRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_shift_templates")
    .update({
      name: input.name.trim(),
      start_time: input.startTime,
      end_time: input.endTime,
      unpaid_break_minutes: input.unpaidBreakMinutes ?? 0,
      location: input.location?.trim() || null,
      label: input.label?.trim() || null,
    })
    .eq("id", templateId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update shift template");
  }

  return data;
}

export async function deleteWorkShiftTemplate(templateId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("work_shift_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete shift template");
  }
}
