import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/notifications/cron-auth";
import { materializeAllActiveTemplates } from "@/lib/data/recurrence";
import { findAllowedUserId } from "@/lib/notifications/workload-admin";
import { getAllowedEmail, getCronSecret } from "@/lib/security/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/lib/errors/error-response";
import { AuthenticationError } from "@/lib/errors/app-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const cronSecret = getCronSecret();

    if (!verifyCronSecret(authorization, cronSecret)) {
      throw new AuthenticationError("Invalid cron credentials");
    }

    const admin = createAdminClient();
    const allowedEmail = getAllowedEmail();
    const userId = await findAllowedUserId(admin, allowedEmail);

    if (!userId) {
      return NextResponse.json({
        generated: 0,
        skipped: 0,
        errors: 0,
        message: "No user found",
      });
    }

    const result = await materializeAllActiveTemplates({
      client: admin,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
