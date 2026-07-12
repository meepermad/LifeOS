import { z } from "zod";
import { ConfigurationError } from "@/lib/errors/app-error";
import { assertMicrosoftIntegrationEnabled } from "@/lib/integrations/microsoft/feature-flag";
import {
  assertAiIntentRouterEnabled,
  isAiIntentRouterEnabled,
} from "@/lib/assistant/ai-intent-router/feature-flag";

function isLocalDevelopmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function validateAppUrlForEnvironment(url: string): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!url.startsWith("https://")) {
    throw new ConfigurationError(
      "NEXT_PUBLIC_APP_URL must use HTTPS in production",
    );
  }
}

function refineAppUrl(
  data: { NEXT_PUBLIC_APP_URL: string },
  ctx: z.RefinementCtx,
): void {
  if (process.env.NODE_ENV === "production") {
    if (!data.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NEXT_PUBLIC_APP_URL must use HTTPS in production",
        path: ["NEXT_PUBLIC_APP_URL"],
      });
    }
    return;
  }

  if (
    data.NEXT_PUBLIC_APP_URL.startsWith("http://") &&
    !isLocalDevelopmentUrl(data.NEXT_PUBLIC_APP_URL)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "NEXT_PUBLIC_APP_URL must use HTTPS or a local development origin (http://localhost or http://127.0.0.1)",
      path: ["NEXT_PUBLIC_APP_URL"],
    });
  }
}

const basePublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const supabasePublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const publicEnvSchema = basePublicEnvSchema.superRefine(refineAppUrl);

function optionalTrimmedString() {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().optional());
}

function optionalTrimmedUrl() {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().url().optional());
}

const serverEnvSchema = supabasePublicEnvSchema.extend({
  NEXT_PUBLIC_APP_URL: optionalTrimmedUrl(),
  SUPABASE_SERVICE_ROLE_KEY: optionalTrimmedString(),
  APP_ALLOWED_EMAIL: z.string().email(),
  TOKEN_ENCRYPTION_KEY: optionalTrimmedString(),
  CANVAS_ALLOWED_HOSTNAMES: optionalTrimmedString(),
  CRON_SECRET: optionalTrimmedString(),
  MICROSOFT_INTEGRATION_ENABLED: optionalTrimmedString(),
  MICROSOFT_CLIENT_ID: optionalTrimmedString(),
  MICROSOFT_CLIENT_SECRET: optionalTrimmedString(),
  MICROSOFT_TENANT_ID: optionalTrimmedString(),
  MICROSOFT_REDIRECT_URI: optionalTrimmedUrl(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalTrimmedString(),
  VAPID_PRIVATE_KEY: optionalTrimmedString(),
  VAPID_SUBJECT: optionalTrimmedString(),
  AI_INTENT_ROUTER_ENABLED: optionalTrimmedString(),
  AI_INTENT_PROVIDER: optionalTrimmedString(),
  CLOUDFLARE_ACCOUNT_ID: optionalTrimmedString(),
  CLOUDFLARE_AI_API_TOKEN: optionalTrimmedString(),
  CLOUDFLARE_AI_MODEL: optionalTrimmedString(),
  AI_INTENT_ROUTER_DAILY_CAP: optionalTrimmedString(),
  AI_INTENT_ROUTER_TIMEOUT_MS: optionalTrimmedString(),
  AI_INTENT_ROUTER_MIN_CONFIDENCE: optionalTrimmedString(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type SupabasePublicEnv = z.infer<typeof supabasePublicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedPublicEnv: PublicEnv | null = null;
let cachedSupabasePublicEnv: SupabasePublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;
let cachedAllowedEmail: string | null = null;

export function getSupabasePublicEnv(): SupabasePublicEnv {
  if (cachedSupabasePublicEnv) {
    return cachedSupabasePublicEnv;
  }

  const result = supabasePublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    throw new ConfigurationError(
      "Supabase public environment is not configured",
    );
  }

  cachedSupabasePublicEnv = result.data;
  return cachedSupabasePublicEnv;
}

export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }

  cachedPublicEnv = publicEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return cachedPublicEnv;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const result = serverEnvSchema.safeParse({
    ...getSupabasePublicEnv(),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_ALLOWED_EMAIL: process.env.APP_ALLOWED_EMAIL,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    CANVAS_ALLOWED_HOSTNAMES: process.env.CANVAS_ALLOWED_HOSTNAMES,
    CRON_SECRET: process.env.CRON_SECRET,
    MICROSOFT_INTEGRATION_ENABLED: process.env.MICROSOFT_INTEGRATION_ENABLED,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
    MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID,
    MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    AI_INTENT_ROUTER_ENABLED: process.env.AI_INTENT_ROUTER_ENABLED,
    AI_INTENT_PROVIDER: process.env.AI_INTENT_PROVIDER,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_AI_API_TOKEN: process.env.CLOUDFLARE_AI_API_TOKEN,
    CLOUDFLARE_AI_MODEL: process.env.CLOUDFLARE_AI_MODEL,
    AI_INTENT_ROUTER_DAILY_CAP: process.env.AI_INTENT_ROUTER_DAILY_CAP,
    AI_INTENT_ROUTER_TIMEOUT_MS: process.env.AI_INTENT_ROUTER_TIMEOUT_MS,
    AI_INTENT_ROUTER_MIN_CONFIDENCE: process.env.AI_INTENT_ROUTER_MIN_CONFIDENCE,
  });

  if (!result.success) {
    throw new ConfigurationError("Server environment is not configured");
  }

  cachedServerEnv = result.data;
  return cachedServerEnv;
}

export function getOptionalVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key ? key : null;
}

export function getAllowedEmail(): string {
  if (cachedAllowedEmail) {
    return cachedAllowedEmail;
  }

  const result = z.string().email().safeParse(process.env.APP_ALLOWED_EMAIL);
  if (!result.success) {
    throw new ConfigurationError("APP_ALLOWED_EMAIL is not configured");
  }

  cachedAllowedEmail = result.data.toLowerCase();
  return cachedAllowedEmail;
}

export function getTokenEncryptionKeyBytes(): Buffer {
  const raw = getServerEnv().TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new ConfigurationError(
      "TOKEN_ENCRYPTION_KEY is required for Canvas credential storage",
    );
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new ConfigurationError(
      "TOKEN_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key",
    );
  }

  if (key.length !== 32) {
    throw new ConfigurationError(
      "TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes",
    );
  }

  return key;
}

export function getCanvasAllowedHostnames(): string[] {
  const raw = getServerEnv().CANVAS_ALLOWED_HOSTNAMES;
  if (!raw?.trim()) {
    throw new ConfigurationError(
      "CANVAS_ALLOWED_HOSTNAMES is required for Canvas feed validation",
    );
  }

  const hostnames = raw
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (hostnames.length === 0) {
    throw new ConfigurationError(
      "CANVAS_ALLOWED_HOSTNAMES must include at least one hostname",
    );
  }

  return hostnames;
}

export function getVapidPublicKey(): string {
  const key = getServerEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    throw new ConfigurationError(
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY is required for Web Push",
    );
  }
  return key;
}

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function getVapidConfig(): VapidConfig {
  const env = getServerEnv();
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new ConfigurationError(
      "VAPID keys and subject are required for Web Push delivery",
    );
  }

  return { publicKey, privateKey, subject };
}

export function getCronSecret(): string {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) {
    throw new ConfigurationError("CRON_SECRET is required for cron endpoints");
  }
  return secret;
}

export type MicrosoftConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  authority: string;
};

export function getMicrosoftConfig(): MicrosoftConfig {
  assertMicrosoftIntegrationEnabled();
  const env = getServerEnv();
  const clientId = env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenantId = env.MICROSOFT_TENANT_ID?.trim() || "organizations";
  const redirectUri = env.MICROSOFT_REDIRECT_URI?.trim();

  if (!clientId) {
    throw new ConfigurationError("MICROSOFT_CLIENT_ID is required for Microsoft integration");
  }
  if (!clientSecret) {
    throw new ConfigurationError(
      "MICROSOFT_CLIENT_SECRET is required for Microsoft integration",
    );
  }
  if (!redirectUri) {
    throw new ConfigurationError(
      "MICROSOFT_REDIRECT_URI is required for Microsoft integration",
    );
  }

  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  };
}

export type AiIntentRouterConfig = {
  provider: "cloudflare";
  accountId: string;
  apiToken: string;
  model: string;
  dailyCap: number;
  timeoutMs: number;
  minConfidence: number;
};

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseConfidence(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
}

export function getAiIntentRouterConfig(): AiIntentRouterConfig | null {
  if (!isAiIntentRouterEnabled()) {
    return null;
  }

  assertAiIntentRouterEnabled();
  const env = getServerEnv();
  const provider = (env.AI_INTENT_PROVIDER?.trim().toLowerCase() ?? "cloudflare") as
    | "cloudflare";

  if (provider !== "cloudflare") {
    return null;
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = env.CLOUDFLARE_AI_API_TOKEN?.trim();
  const model =
    env.CLOUDFLARE_AI_MODEL?.trim() || "@cf/meta/llama-3.1-8b-instruct";

  if (!accountId || !apiToken) {
    return null;
  }

  return {
    provider,
    accountId,
    apiToken,
    model,
    dailyCap: parsePositiveInt(env.AI_INTENT_ROUTER_DAILY_CAP, 50),
    timeoutMs: parsePositiveInt(env.AI_INTENT_ROUTER_TIMEOUT_MS, 8000),
    minConfidence: parseConfidence(env.AI_INTENT_ROUTER_MIN_CONFIDENCE, 0.7),
  };
}
