import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/notifications/cron-auth";
import { processScheduledNotifications } from "@/lib/notifications/scheduling";
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
        daily: 0,
        weekly: 0,
        deadline: 0,
        overload: 0,
        skipped: 0,
        errors: 0,
        message: "No user found",
      });
    }

    const { data: preferences } = await admin
      .from("planning_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    const { data: profile } = await admin
      .from("profiles")
      .select("week_starts_on")
      .eq("id", userId)
      .single();

    if (!preferences) {
      return NextResponse.json({
        daily: 0,
        weekly: 0,
        deadline: 0,
        overload: 0,
        skipped: 0,
        errors: 0,
        message: "No preferences found",
      });
    }

    const result = await processScheduledNotifications(
      admin,
      userId,
      preferences,
      (profile?.week_starts_on ?? 0) as 0 | 1,
    );

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
