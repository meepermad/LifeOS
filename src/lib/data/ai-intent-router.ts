import { createAdminClient } from "@/lib/supabase/admin";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  timeout: "The language fallback timed out.",
  rate_limited: "The language fallback rate limit was reached.",
  provider_error: "The language fallback provider returned an error.",
  daily_cap: "The daily language fallback limit was reached.",
  circuit_open: "The language fallback is temporarily unavailable.",
  schema_invalid: "The language fallback returned an invalid response.",
  semantic_invalid: "The language fallback could not interpret that command.",
  low_confidence: "The language fallback was not confident enough.",
  network_error: "The language fallback could not connect.",
};

export async function getDailyUsageCount(userId: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("ai_intent_router_daily_usage")
      .select("request_count")
      .eq("user_id", userId)
      .eq("usage_date", todayDateKey())
      .maybeSingle();

    return data?.request_count ?? 0;
  } catch {
    return 0;
  }
}

export async function incrementDailyUsage(userId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const usageDate = todayDateKey();

    const { data: existing } = await supabase
      .from("ai_intent_router_daily_usage")
      .select("id, request_count")
      .eq("user_id", userId)
      .eq("usage_date", usageDate)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("ai_intent_router_daily_usage")
        .update({ request_count: (existing.request_count ?? 0) + 1 })
        .eq("id", existing.id);
      return;
    }

    await supabase.from("ai_intent_router_daily_usage").insert({
      user_id: userId,
      usage_date: usageDate,
      request_count: 1,
    });
  } catch {
    // Usage tracking must not break command flow.
  }
}

export async function logAiIntentRouterTelemetry(input: {
  userId: string;
  provider: string;
  model: string;
  schemaVersion: number;
  selectedIntent: string | null;
  confidenceBucket: string | null;
  status: "success" | "failure";
  errorCategory: string | null;
  latencyBucketMs: string | null;
  usageUnits?: number | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();

    await supabase.from("ai_intent_router_telemetry").insert({
      user_id: input.userId,
      provider: input.provider,
      model: input.model,
      schema_version: input.schemaVersion,
      selected_intent: input.selectedIntent,
      confidence_bucket: input.confidenceBucket,
      status: input.status,
      error_category: input.errorCategory,
      latency_bucket_ms: input.latencyBucketMs,
      usage_units: input.usageUnits ?? null,
    });
  } catch {
    // Telemetry must not break command flow.
  }
}

export async function getLastSafeProviderError(
  userId: string,
): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("ai_intent_router_telemetry")
      .select("error_category")
      .eq("user_id", userId)
      .eq("status", "failure")
      .not("error_category", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.error_category) return null;
    return SAFE_ERROR_MESSAGES[data.error_category] ?? "Language fallback failed.";
  } catch {
    return null;
  }
}

export async function purgeExpiredAiIntentRouterTelemetry(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_intent_router_telemetry")
    .delete()
    .lt("retention_expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    return 0;
  }

  return data?.length ?? 0;
}
