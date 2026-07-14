import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getPlanningPreferences } from "@/lib/data/preferences";
import {
  getAppLocalDateKey,
  getDayBoundsInUtc,
  nowInAppTimezone,
} from "@/lib/dates/timezone";
import { countBlocksAwaitingFeedback } from "@/lib/planning/awaiting-feedback";
import { getOverdueTasksNeedingDecision } from "@/lib/reviews/overdue";
import { countWaitingFollowupsDue } from "@/lib/notifications/workflow-queries";

export type Phase13DiagnosticsCounts = {
  activeTemplates: number;
  templatesNeedingGeneration: number;
  openReviewSessions: number;
  completedReviewsToday: number;
  tasksAwaitingDecisions: number;
  blocksAwaitingFeedback: number;
  deferredBecomingActionable: number;
  waitingFollowupsDue: number;
  notificationEligibility: {
    morningReview: boolean;
    eveningReview: boolean;
    weeklyReview: boolean;
    waitingFollowup: boolean;
    overdueDecision: boolean;
    planningFeedback: boolean;
  };
};

export async function GET() {
  try {
    const user = await requireAllowedUser();
    const supabase = await createClient();
    const prefs = await getPlanningPreferences();
    const now = nowInAppTimezone();
    const todayKey = getAppLocalDateKey(now);
    const dayBounds = getDayBoundsInUtc(todayKey);
    const nowIso = now.toISOString();

    const [
      activeTemplatesResult,
      needingGenerationResult,
      openSessionsResult,
      completedTodayResult,
      deferredResult,
      awaitingDecisions,
      blocksAwaitingFeedback,
      waitingFollowupsDue,
    ] = await Promise.all([
      supabase
        .from("task_recurrence_templates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true)
        .is("archived_at", null),
      supabase
        .from("task_recurrence_templates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true)
        .is("paused_at", null)
        .is("archived_at", null)
        .is("ended_at", null),
      supabase
        .from("review_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("completed_at", null),
      supabase
        .from("review_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .gte("completed_at", dayBounds.start.toISOString())
        .lte("completed_at", dayBounds.end.toISOString()),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["open", "in_progress", "deferred"])
        .not("deferred_until_at", "is", null)
        .lte("deferred_until_at", nowIso),
      getOverdueTasksNeedingDecision(todayKey),
      countBlocksAwaitingFeedback(),
      countWaitingFollowupsDue(supabase, user.id, now),
    ]);

    const body: Phase13DiagnosticsCounts = {
      activeTemplates: activeTemplatesResult.count ?? 0,
      templatesNeedingGeneration: needingGenerationResult.count ?? 0,
      openReviewSessions: openSessionsResult.count ?? 0,
      completedReviewsToday: completedTodayResult.count ?? 0,
      tasksAwaitingDecisions: awaitingDecisions.length,
      blocksAwaitingFeedback,
      deferredBecomingActionable: deferredResult.count ?? 0,
      waitingFollowupsDue,
      notificationEligibility: {
        morningReview: prefs.morning_review_enabled === true,
        eveningReview: prefs.evening_review_enabled === true,
        weeklyReview: prefs.weekly_review_reminder_enabled === true,
        waitingFollowup: prefs.waiting_followup_enabled === true,
        overdueDecision: prefs.overdue_decision_reminder_enabled === true,
        planningFeedback: prefs.planning_feedback_reminder_enabled === true,
      },
    };

    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
