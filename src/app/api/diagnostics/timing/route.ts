import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { getEditWorkflow } from "@/lib/calendar/authorization";
import { loadCalibrationContext } from "@/lib/analytics/planning-calibration";
import { isStaleTimer } from "@/lib/time/stale-timer";
import { getActiveTimer } from "@/lib/data/time-entries";
import { listEventsInRange } from "@/lib/data/events";
import { getTodayBoundsUtc, nowInAppTimezone } from "@/lib/dates/timezone";

export async function GET() {
  try {
    const user = await requireAllowedUser();
    const supabase = await createClient();
    const prefs = await getPlanningPreferences();
    const privacy =
      prefs.notification_privacy_mode === "private" ? "private" : "detailed";

    const active = await getActiveTimer();
    const threshold = prefs.stale_timer_threshold_hours ?? 4;
    const stale = active ? isStaleTimer(active, threshold) : false;
    const timerAgeHours = active
      ? Math.round(
          ((Date.now() - new Date(active.entry.started_at).getTime()) /
            (1000 * 60 * 60)) *
            10,
        ) / 10
      : null;

    const { count: pauseCount } = await supabase
      .from("timer_pause_segments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("resumed_at", null);

    const { count: currentSnapshots } = await supabase
      .from("task_completion_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_current", true);

    const calibration = await loadCalibrationContext(prefs.calibration_reset_at);
    const calibrationGroups = [...calibration.samplesByGroup.entries()].map(
      ([key, samples]) => ({
        group: key,
        sampleCount: samples.length,
      }),
    );

    const bounds = getTodayBoundsUtc(nowInAppTimezone());
    const todayEvents = await listEventsInRange(
      bounds.start.toISOString(),
      bounds.end.toISOString(),
    );
    const workflowCounts: Record<string, number> = {};
    for (const event of todayEvents) {
      const workflow = getEditWorkflow(event);
      workflowCounts[workflow] = (workflowCounts[workflow] ?? 0) + 1;
    }

    return NextResponse.json({
      privacyMode: privacy,
      activeTimer: active
        ? {
            ageHours: timerAgeHours,
            isStale: stale,
            isPaused: active.isPaused,
            ...(privacy === "detailed"
              ? { taskTitle: active.entry.task_title_snapshot }
              : {}),
          }
        : null,
      openPauseSegments: pauseCount ?? 0,
      currentSnapshotCount: currentSnapshots ?? 0,
      calibrationGroups,
      staleNotificationEligible:
        stale && prefs.stale_timer_notified_at == null,
      calendarWorkflowCounts: workflowCounts,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
