import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { DatabaseError } from "@/lib/errors/app-error";
import { createClient } from "@/lib/supabase/server";
import type { WorkProfileRow } from "@/types/domain";

export type WorkProfileInput = {
  employerName: string;
  roleTitle?: string;
  displayName: string;
  defaultLocation?: string;
  defaultUnpaidBreakMinutes?: number;
  iconKey?: string;
};

export async function listActiveWorkProfiles(): Promise<WorkProfileRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("archived_at", null)
    .order("display_name");
  if (error) throw new DatabaseError("Failed to load work profiles");
  return data ?? [];
}

export async function listAllWorkProfiles(): Promise<WorkProfileRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("display_name");
  if (error) throw new DatabaseError("Failed to load work profiles");
  return data ?? [];
}

function profilePayload(input: WorkProfileInput) {
  return {
    employer_name: input.employerName.trim(),
    role_title: input.roleTitle?.trim() || null,
    display_name: input.displayName.trim(),
    default_location: input.defaultLocation?.trim() || null,
    default_unpaid_break_minutes: input.defaultUnpaidBreakMinutes ?? 0,
    icon_key: input.iconKey?.trim() || null,
  };
}

export async function createWorkProfile(input: WorkProfileInput): Promise<WorkProfileRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_profiles")
    .insert({ user_id: user.id, ...profilePayload(input) })
    .select("*")
    .single();
  if (error || !data) throw new DatabaseError("Failed to create work profile");
  return data;
}

export async function updateWorkProfile(
  id: string,
  input: WorkProfileInput,
): Promise<WorkProfileRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_profiles")
    .update(profilePayload(input))
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error || !data) throw new DatabaseError("Failed to update work profile");
  return data;
}

export async function archiveWorkProfile(id: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_profiles")
    .update({ is_active: false, archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new DatabaseError("Failed to archive work profile");
}
