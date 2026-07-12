import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";

export async function logParserOutcome(input: {
  normalizedIntent: string | null;
  success: boolean;
  clarificationReason?: string | null;
  dateRangeKind?: string | null;
  weekOffset?: number | null;
}): Promise<void> {
  try {
    const user = await requireAllowedUser();
    const supabase = await createClient();

    const { error } = await supabase.from("assistant_parser_outcomes").insert({
      user_id: user.id,
      normalized_intent: input.normalizedIntent,
      success: input.success,
      clarification_reason: input.clarificationReason ?? null,
      date_range_kind: input.dateRangeKind ?? null,
      week_offset: input.weekOffset ?? null,
    });

    if (error) {
      throw new DatabaseError("Failed to log parser outcome");
    }
  } catch {
    // Telemetry should not break command flow.
  }
}

export async function purgeExpiredParserOutcomes(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assistant_parser_outcomes")
    .delete()
    .lt("retention_expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    throw new DatabaseError("Failed to purge expired parser outcomes");
  }

  return data?.length ?? 0;
}
