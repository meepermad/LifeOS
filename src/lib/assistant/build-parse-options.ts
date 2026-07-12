import type { ParseCommandOptions } from "@/lib/assistant/parse-options";
import { createAdminClient } from "@/lib/supabase/admin";

export async function buildParseOptionsForUser(
  userId: string,
  timezone?: string,
): Promise<ParseCommandOptions> {
  const supabase = createAdminClient();

  const [{ data: profile }, { data: terms }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    supabase
      .from("academic_terms")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false }),
  ]);

  const activeTerm = (terms ?? []).find((term) => term.status === "active");
  let exceptions = [];
  if (activeTerm) {
    const { data } = await supabase
      .from("academic_exceptions")
      .select("*")
      .eq("user_id", userId)
      .eq("academic_term_id", activeTerm.id)
      .order("start_date")
      .order("id");
    exceptions = data ?? [];
  }

  const resolvedTimezone = timezone ?? profile?.timezone ?? "America/Chicago";

  return {
    timezone: resolvedTimezone,
    academicContext: {
      terms: terms ?? [],
      exceptions,
      timezone: resolvedTimezone,
    },
  };
}
