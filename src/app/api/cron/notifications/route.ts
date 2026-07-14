import { NextResponse } from "next/server";
import { APP_TIMEZONE } from "@/lib/constants";
import { verifyCronSecret } from "@/lib/notifications/cron-auth";
import {
  processScheduledNotifications,
  type ProcessResult,
} from "@/lib/notifications/scheduling";
import { findAllowedUserId } from "@/lib/notifications/workload-admin";
import { getAllowedEmail, getCronSecret } from "@/lib/security/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/lib/errors/error-response";
import { AuthenticationError } from "@/lib/errors/app-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyCronResult(message: string): ProcessResult & { message: string } {
  return {
    daily: 0,
    weekly: 0,
    deadline: 0,
    overload: 0,
    staleTimer: 0,
    morningReview: 0,
    eveningReview: 0,
    weeklyReview: 0,
    waitingFollowup: 0,
    overdueDecision: 0,
    planningFeedback: 0,
    usersProcessed: 0,
    disabled: 0,
    notDue: 0,
    stale: 0,
    deduplicated: 0,
    noContent: 0,
    noSubscription: 0,
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    message,
  };
}

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
      return NextResponse.json(emptyCronResult("No user found"));
    }

    const { data: preferences } = await admin
      .from("planning_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    const { data: profile } = await admin
      .from("profiles")
      .select("week_starts_on, timezone")
      .eq("id", userId)
      .single();

    if (!preferences) {
      return NextResponse.json(emptyCronResult("No preferences found"));
    }

    const result = await processScheduledNotifications(
      admin,
      userId,
      preferences,
      (profile?.week_starts_on ?? 0) as 0 | 1,
      new Date(),
      profile?.timezone ?? APP_TIMEZONE,
    );

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
