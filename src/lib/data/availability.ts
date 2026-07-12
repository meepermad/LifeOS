import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import {
  availabilityFormSchema,
  normalizeTimeForDb,
  type AvailabilityFormInput,
} from "@/lib/validation/availability";
import type { AvailabilityRuleRow } from "@/types/domain";

export async function listAvailabilityRules(): Promise<AvailabilityRuleRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("day_of_week")
    .order("available_start");

  if (error) {
    throw new DatabaseError("Failed to load availability rules");
  }

  return data ?? [];
}

export async function createAvailabilityRule(
  input: AvailabilityFormInput,
): Promise<AvailabilityRuleRow> {
  const user = await requireAllowedUser();
  const parsed = availabilityFormSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_rules")
    .insert({
      user_id: user.id,
      day_of_week: parsed.dayOfWeek,
      available_start: normalizeTimeForDb(parsed.availableStart),
      available_end: normalizeTimeForDb(parsed.availableEnd),
      maximum_focus_minutes: parsed.maximumFocusMinutes ?? null,
      preferred_block_minutes: parsed.preferredBlockMinutes ?? null,
      is_enabled: parsed.isEnabled,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create availability rule");
  }

  return data;
}

export async function updateAvailabilityRule(
  ruleId: string,
  input: AvailabilityFormInput,
): Promise<AvailabilityRuleRow> {
  const user = await requireAllowedUser();
  const parsed = availabilityFormSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_rules")
    .update({
      day_of_week: parsed.dayOfWeek,
      available_start: normalizeTimeForDb(parsed.availableStart),
      available_end: normalizeTimeForDb(parsed.availableEnd),
      maximum_focus_minutes: parsed.maximumFocusMinutes ?? null,
      preferred_block_minutes: parsed.preferredBlockMinutes ?? null,
      is_enabled: parsed.isEnabled,
    })
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update availability rule");
  }

  return data;
}

export async function toggleAvailabilityRule(
  ruleId: string,
  isEnabled: boolean,
): Promise<AvailabilityRuleRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_rules")
    .update({ is_enabled: isEnabled })
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update availability rule");
  }

  return data;
}

export async function deleteAvailabilityRule(ruleId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("availability_rules")
    .delete()
    .eq("id", ruleId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to delete availability rule");
  }
}

export function groupAvailabilityByDay(
  rules: AvailabilityRuleRow[],
): Map<number, AvailabilityRuleRow[]> {
  const grouped = new Map<number, AvailabilityRuleRow[]>();

  for (const rule of rules) {
    const existing = grouped.get(rule.day_of_week) ?? [];
    existing.push(rule);
    grouped.set(rule.day_of_week, existing);
  }

  return grouped;
}
