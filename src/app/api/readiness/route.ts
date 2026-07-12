import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/notifications/cron-auth";
import { getCronSecret, getServerEnv } from "@/lib/security/env";
import { errorResponse } from "@/lib/errors/error-response";
import { AuthenticationError } from "@/lib/errors/app-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ReadinessChecks = {
  appUrl: boolean;
  supabasePublic: boolean;
  allowedEmail: boolean;
  serviceRole: boolean;
  cronSecret: boolean;
  vapid: boolean;
  canvasEncryption: boolean;
};

function hasValidEncryptionKey(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
}

function buildReadinessChecks(): ReadinessChecks {
  const env = getServerEnv();

  return {
    appUrl: Boolean(env.NEXT_PUBLIC_APP_URL),
    supabasePublic: Boolean(
      env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    allowedEmail: Boolean(env.APP_ALLOWED_EMAIL),
    serviceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    cronSecret: Boolean(env.CRON_SECRET),
    vapid: Boolean(
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        env.VAPID_PRIVATE_KEY &&
        env.VAPID_SUBJECT,
    ),
    canvasEncryption:
      hasValidEncryptionKey(env.TOKEN_ENCRYPTION_KEY) &&
      Boolean(env.CANVAS_ALLOWED_HOSTNAMES?.trim()),
  };
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const cronSecret = getCronSecret();

    if (!verifyCronSecret(authorization, cronSecret)) {
      throw new AuthenticationError("Invalid cron credentials");
    }

    const checks = buildReadinessChecks();
    const ready = Object.values(checks).every(Boolean);

    return NextResponse.json({ ready, checks });
  } catch (error) {
    return errorResponse(error);
  }
}
