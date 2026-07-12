export type IntentRouterInput = {
  message: string;
  currentDate: string;
  timezone: string;
  allowedIntents: readonly string[];
  allowedRangeKinds: readonly string[];
};

export type IntentRouterRange = {
  kind: string;
  offset?: number | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type IntentRouterResult = {
  schemaVersion: 1;
  status: "matched" | "clarification_required" | "unsupported";
  intent: string;
  confidence: number;
  range: IntentRouterRange | null;
  entities: Record<string, unknown>;
  clarificationQuestion: string | null;
};

export interface IntentRouterProvider {
  classify(
    input: IntentRouterInput,
    signal: AbortSignal,
  ): Promise<IntentRouterResult>;
}

export type IntentRouterErrorCategory =
  | "disabled"
  | "misconfigured"
  | "rate_limited"
  | "daily_cap"
  | "circuit_open"
  | "timeout"
  | "provider_error"
  | "invalid_json"
  | "schema_invalid"
  | "semantic_invalid"
  | "low_confidence"
  | "network_error";

export type IntentRouterAttemptResult =
  | { ok: true; result: IntentRouterResult }
  | { ok: false; category: IntentRouterErrorCategory; safeMessage: string };

export type IntentRouterStatus = {
  enabled: boolean;
  provider: string | null;
  dailyCap: number;
  requestsUsedToday: number;
  lastSafeError: string | null;
};
