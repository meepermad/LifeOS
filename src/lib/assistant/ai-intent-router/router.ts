import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";
import { getAiIntentRouterConfig } from "@/lib/security/env";
import { isAiIntentRouterEnabled } from "./feature-flag";
import {
  getAllowlistForPrompt,
  isClearlyUnsupportedMessage,
  isConfirmationOrCancellationMessage,
} from "./allowlist";
import { validateIntentRouterResult } from "./schemas";
import {
  validateSemanticIntentRouterResult,
  confidenceBucket,
  latencyBucket,
} from "./semantic-validator";
import { mapIntentRouterResultToParseResult } from "./mapper";
import { createIntentRouterProvider } from "./providers";
import {
  checkGlobalInMemoryCap,
  checkUserRateLimit,
  isCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
} from "./rate-limit";
import type { ParseCommandOptions } from "@/lib/assistant/parse-options";
import type { ParseResult } from "@/lib/assistant/intents";
import type { IntentRouterErrorCategory } from "./types";
import {
  getDailyUsageCount,
  incrementDailyUsage,
  logAiIntentRouterTelemetry,
  getLastSafeProviderError,
} from "@/lib/data/ai-intent-router";

export type TryAiIntentRouterOptions = {
  message: string;
  userId: string;
  parseOptions?: ParseCommandOptions;
  maxLength?: number;
};

export type TryAiIntentRouterResult =
  | { attempted: false; reason: IntentRouterErrorCategory }
  | { attempted: true; parseResult: ParseResult; intent?: string };

function shouldSkipAi(message: string, maxLength: number): IntentRouterErrorCategory | null {
  const trimmed = message.trim();
  if (!trimmed) return "disabled";
  if (trimmed.length > maxLength) return "disabled";
  if (isConfirmationOrCancellationMessage(trimmed)) return "disabled";
  if (isClearlyUnsupportedMessage(trimmed)) return "disabled";
  return null;
}

export async function tryAiIntentRouter(
  options: TryAiIntentRouterOptions,
): Promise<TryAiIntentRouterResult> {
  const maxLength = options.maxLength ?? 2000;
  const skipReason = shouldSkipAi(options.message, maxLength);
  if (skipReason) {
    return { attempted: false, reason: skipReason };
  }

  if (!isAiIntentRouterEnabled()) {
    return { attempted: false, reason: "disabled" };
  }

  const config = getAiIntentRouterConfig();
  if (!config) {
    return { attempted: false, reason: "misconfigured" };
  }

  if (isCircuitOpen()) {
    return { attempted: false, reason: "circuit_open" };
  }

  if (!checkUserRateLimit(options.userId)) {
    return { attempted: false, reason: "rate_limited" };
  }

  const usedToday = await getDailyUsageCount(options.userId);
  if (usedToday >= config.dailyCap) {
    return { attempted: false, reason: "daily_cap" };
  }

  if (!checkGlobalInMemoryCap(config.dailyCap)) {
    return { attempted: false, reason: "daily_cap" };
  }

  const provider = createIntentRouterProvider();
  if (!provider) {
    return { attempted: false, reason: "misconfigured" };
  }

  const now = options.parseOptions?.now ?? new Date();
  const timezone = options.parseOptions?.timezone ?? APP_TIMEZONE;
  const { allowedIntents, allowedRangeKinds } = getAllowlistForPrompt();

  const input = {
    message: options.message,
    currentDate: formatInTimeZone(now, timezone, "yyyy-MM-dd"),
    timezone,
    allowedIntents,
    allowedRangeKinds,
  };

  const started = Date.now();
  let rawResult: unknown;

  const invoke = async (signal: AbortSignal) => {
    return provider.classify(input, signal);
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      rawResult = await invoke(controller.signal);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        await logAiIntentRouterTelemetry({
          userId: options.userId,
          provider: config.provider,
          model: config.model,
          schemaVersion: 1,
          selectedIntent: null,
          confidenceBucket: null,
          status: "failure",
          errorCategory: "timeout",
          latencyBucketMs: latencyBucket(Date.now() - started),
        });
        recordProviderFailure();
        return { attempted: false, reason: "timeout" as const };
      }

      const code =
        error instanceof Error && "code" in error
          ? String((error as Error & { code?: string }).code)
          : "network_error";

      if (code === "rate_limited") {
        await logAiIntentRouterTelemetry({
          userId: options.userId,
          provider: config.provider,
          model: config.model,
          schemaVersion: 1,
          selectedIntent: null,
          confidenceBucket: null,
          status: "failure",
          errorCategory: "rate_limited",
          latencyBucketMs: latencyBucket(Date.now() - started),
        });
        recordProviderFailure();
        return { attempted: false, reason: "rate_limited" as const };
      }

      await logAiIntentRouterTelemetry({
        userId: options.userId,
        provider: config.provider,
        model: config.model,
        schemaVersion: 1,
        selectedIntent: null,
        confidenceBucket: null,
        status: "failure",
        errorCategory: "provider_error",
        latencyBucketMs: latencyBucket(Date.now() - started),
      });
      recordProviderFailure();
      return { attempted: false, reason: "provider_error" as const };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    recordProviderFailure();
    return { attempted: false, reason: "network_error" };
  }

  const schemaValidation = validateIntentRouterResult(rawResult, allowedIntents);
  if (!schemaValidation.ok) {
    await logAiIntentRouterTelemetry({
      userId: options.userId,
      provider: config.provider,
      model: config.model,
      schemaVersion: 1,
      selectedIntent: null,
      confidenceBucket: null,
      status: "failure",
      errorCategory: "schema_invalid",
      latencyBucketMs: latencyBucket(Date.now() - started),
    });
    return { attempted: false, reason: "schema_invalid" };
  }

  const semanticContext = {
    message: options.message,
    now,
    timezone,
    academicContext: options.parseOptions?.academicContext,
    minConfidence: config.minConfidence,
  };

  const semanticValidation = validateSemanticIntentRouterResult(
    schemaValidation.data,
    semanticContext,
  );

  if (!semanticValidation.ok) {
    await logAiIntentRouterTelemetry({
      userId: options.userId,
      provider: config.provider,
      model: config.model,
      schemaVersion: 1,
      selectedIntent: schemaValidation.data.intent,
      confidenceBucket: confidenceBucket(schemaValidation.data.confidence),
      status: "failure",
      errorCategory:
        semanticValidation.reason === "low_confidence"
          ? "low_confidence"
          : "semantic_invalid",
      latencyBucketMs: latencyBucket(Date.now() - started),
    });
    return {
      attempted: false,
      reason:
        semanticValidation.reason === "low_confidence"
          ? "low_confidence"
          : "semantic_invalid",
    };
  }

  await incrementDailyUsage(options.userId);
  recordProviderSuccess();

  await logAiIntentRouterTelemetry({
    userId: options.userId,
    provider: config.provider,
    model: config.model,
    schemaVersion: 1,
    selectedIntent: semanticValidation.data.intent,
    confidenceBucket: confidenceBucket(semanticValidation.data.confidence),
    status: "success",
    errorCategory: null,
    latencyBucketMs: latencyBucket(Date.now() - started),
  });

  const parseResult = mapIntentRouterResultToParseResult(
    semanticValidation.data,
    semanticContext,
  );

  return {
    attempted: true,
    parseResult,
    intent:
      parseResult.kind === "command" ? parseResult.command.intent : undefined,
  };
}

export async function getAiIntentRouterStatus(
  userId: string,
): Promise<{
  enabled: boolean;
  provider: string | null;
  dailyCap: number;
  requestsUsedToday: number;
  lastSafeError: string | null;
}> {
  const enabled = isAiIntentRouterEnabled();
  const config = getAiIntentRouterConfig();
  const requestsUsedToday = enabled ? await getDailyUsageCount(userId) : 0;
  const lastSafeError = enabled ? await getLastSafeProviderError(userId) : null;

  return {
    enabled: enabled && config !== null,
    provider: config?.provider ?? null,
    dailyCap: config?.dailyCap ?? 50,
    requestsUsedToday,
    lastSafeError,
  };
}

export async function testAiIntentRouterClassification(input: {
  message: string;
  userId: string;
  parseOptions?: ParseCommandOptions;
}): Promise<{
  status: "matched" | "clarification" | "unsupported" | "unavailable";
  intent: string | null;
  confidenceBucket: string | null;
}> {
  const result = await tryAiIntentRouter({
    message: input.message,
    userId: input.userId,
    parseOptions: input.parseOptions,
    maxLength: 500,
  });

  if (!result.attempted) {
    return { status: "unavailable", intent: null, confidenceBucket: null };
  }

  if (result.parseResult.kind === "command") {
    return {
      status: "matched",
      intent: result.parseResult.command.intent,
      confidenceBucket: null,
    };
  }

  if (result.parseResult.kind === "clarification") {
    return {
      status: "clarification",
      intent: result.parseResult.partial.intent ?? null,
      confidenceBucket: null,
    };
  }

  return { status: "unsupported", intent: null, confidenceBucket: null };
}
