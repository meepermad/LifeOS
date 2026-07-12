import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeOptionalTime,
  planningPreferencesSchema,
  type PlanningPreferencesFormInput,
} from "@/lib/validation/preferences";
import { updateProfileSettings } from "@/lib/data/bootstrap";
import type { PlanningPreferencesRow } from "@/types/domain";

export async function getPlanningPreferences(): Promise<PlanningPreferencesRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("planning_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new DatabaseError("Planning preferences not found");
  }

  return data;
}

export async function updatePlanningPreferences(
  input: PlanningPreferencesFormInput,
): Promise<PlanningPreferencesRow> {
  const user = await requireAllowedUser();
  const parsed = planningPreferencesSchema.parse(input);
  const supabase = await createClient();

  if (parsed.weekStartsOn !== undefined) {
    await updateProfileSettings({ weekStartsOn: parsed.weekStartsOn as 0 | 1 });
  }

  const { data, error } = await supabase
    .from("planning_preferences")
    .update({
      minimum_break_minutes: parsed.minimumBreakMinutes,
      travel_buffer_minutes: parsed.travelBufferMinutes,
      planning_buffer_percent: parsed.planningBufferPercent,
      preferred_focus_block_minutes: parsed.preferredFocusBlockMinutes,
      maximum_focus_block_minutes: parsed.maximumFocusBlockMinutes,
      daily_notification_time: normalizeOptionalTime(parsed.dailyNotificationTime),
      weekly_notification_day: parsed.weeklyNotificationDay,
      weekly_notification_time: normalizeOptionalTime(parsed.weeklyNotificationTime),
      auto_create_focus_blocks: parsed.autoCreateFocusBlocks,
      avoid_difficult_work_after: normalizeOptionalTime(parsed.avoidDifficultWorkAfter),
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update planning preferences");
  }

  return data;
}
