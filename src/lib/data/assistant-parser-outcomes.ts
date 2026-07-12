import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { DatabaseError } from "@/lib/errors/app-error";

export async function logParserOutcome(input: {
  normalizedIntent: string | null;
  success: boolean;
  clarificationReason?: string | null;
  recognizedDatePhrase?: string | null;
}): Promise<void> {
  try {
    const user = await requireAllowedUser();
    const supabase = await createClient();

    const { error } = await supabase.from("assistant_parser_outcomes").insert({
      user_id: user.id,
      normalized_intent: input.normalizedIntent,
      success: input.success,
      clarification_reason: input.clarificationReason ?? null,
      recognized_date_phrase: input.recognizedDatePhrase ?? null,
    });

    if (error) {
      throw new DatabaseError("Failed to log parser outcome");
    }
  } catch {
    // Telemetry should not break command flow.
  }
}
