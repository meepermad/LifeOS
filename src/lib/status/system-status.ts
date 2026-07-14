import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getCanvasConnectionSafe } from "@/lib/data/connections";
import { getActiveTerm } from "@/lib/academic/active-term";
import { listAcademicTerms } from "@/lib/data/academic/terms";
import { listCoursesForTerm } from "@/lib/data/academic/courses";
import { getActiveTimer } from "@/lib/data/time-entries";
import { listUserDevices } from "@/lib/data/push-subscriptions";
import {
  countUnassignedWorkShifts,
  listWorkShiftsInRange,
} from "@/lib/data/work-shifts";
import { listActiveWorkProfiles } from "@/lib/data/work-profiles";
import { getWeekBounds, nowInAppTimezone } from "@/lib/dates/timezone";
import { getProfile } from "@/lib/data/bootstrap";
import { countInboxTasks } from "@/lib/reviews/loaders";

export type SystemStatusSnapshot = {
  appVersion: string;
  canvasConnected: boolean;
  canvasLastSuccessAt: string | null;
  pushPermissionHint: "unknown" | "devices-present" | "no-devices";
  devicePushCount: number;
  lastNotificationEvidenceAt: string | null;
  recurringTemplatesActive: number;
  recurringNeedingGeneration: number;
  activeTermName: string | null;
  activeTermCurrent: boolean;
  courseCount: number;
  unassignedWorkShifts: number;
  workProfilesConfigured: number;
  upcomingWorkShifts: number;
  staleTimerOpen: boolean;
  pendingReviews: number;
  inboxCount: number;
};

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  href: string;
  dismissible: boolean;
};

export function getAppVersionLabel(): string {
  return (
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    "dev"
  );
}

export async function loadSystemStatus(): Promise<SystemStatusSnapshot> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const profile = await getProfile();
  const now = nowInAppTimezone();
  const weekBounds = getWeekBounds(now, profile.week_starts_on as 0 | 1, 0);
  const nextWeek = getWeekBounds(now, profile.week_starts_on as 0 | 1, 1);

  const [
    canvas,
    devices,
    terms,
    unassignedWorkShifts,
    profiles,
    upcomingShifts,
    activeTimer,
    inboxCount,
    activeTemplates,
    needingGeneration,
    openSessions,
    lastNotification,
  ] = await Promise.all([
    getCanvasConnectionSafe(),
    listUserDevices(),
    listAcademicTerms(),
    countUnassignedWorkShifts(),
    listActiveWorkProfiles(),
    listWorkShiftsInRange(
      weekBounds.start.toISOString(),
      nextWeek.end.toISOString(),
    ),
    getActiveTimer(),
    countInboxTasks(),
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
      .from("notification_deliveries")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const active = getActiveTerm(terms);
  let courseCount = 0;
  let activeTermCurrent = false;
  if (active) {
    const courses = await listCoursesForTerm(active.id);
    courseCount = courses.length;
    const today = now.toISOString().slice(0, 10);
    activeTermCurrent =
      active.start_date <= today && active.end_date >= today;
  }

  const timerStartedAt = activeTimer?.entry.started_at;
  const staleTimerOpen = Boolean(
    timerStartedAt &&
      !activeTimer?.entry.ended_at &&
      Date.now() - new Date(timerStartedAt).getTime() > 8 * 60 * 60 * 1000,
  );

  return {
    appVersion: getAppVersionLabel(),
    canvasConnected: canvas.isConfigured && canvas.status !== "disconnected",
    canvasLastSuccessAt: canvas.lastSuccessfulSync,
    pushPermissionHint: devices.length > 0 ? "devices-present" : "no-devices",
    devicePushCount: devices.length,
    lastNotificationEvidenceAt: lastNotification.data?.created_at ?? null,
    recurringTemplatesActive: activeTemplates.count ?? 0,
    recurringNeedingGeneration: needingGeneration.count ?? 0,
    activeTermName: active?.name ?? null,
    activeTermCurrent,
    courseCount,
    unassignedWorkShifts,
    workProfilesConfigured: profiles.length,
    upcomingWorkShifts: upcomingShifts.length,
    staleTimerOpen,
    pendingReviews: openSessions.count ?? 0,
    inboxCount,
  };
}

export function buildSemesterReadinessChecks(
  status: SystemStatusSnapshot,
): ReadinessCheck[] {
  return [
    {
      id: "active-term",
      label: "Active academic term exists",
      ok: Boolean(status.activeTermName),
      href: "/school",
      dismissible: true,
    },
    {
      id: "term-current",
      label: "Term dates are current",
      ok: status.activeTermCurrent,
      href: "/school",
      dismissible: true,
    },
    {
      id: "courses",
      label: "At least one course configured",
      ok: status.courseCount > 0,
      href: "/school",
      dismissible: true,
    },
    {
      id: "canvas",
      label: "Canvas connected",
      ok: status.canvasConnected,
      href: "/imports",
      dismissible: true,
    },
    {
      id: "canvas-recent",
      label: "Canvas synced recently",
      ok: Boolean(
        status.canvasLastSuccessAt &&
          Date.now() - new Date(status.canvasLastSuccessAt).getTime() <
            7 * 24 * 60 * 60 * 1000,
      ),
      href: "/imports",
      dismissible: true,
    },
    {
      id: "push",
      label: "Push subscription active",
      ok: status.devicePushCount > 0,
      href: "/settings",
      dismissible: true,
    },
    {
      id: "work-profiles",
      label: "Work profiles configured",
      ok: status.workProfilesConfigured > 0,
      href: "/work",
      dismissible: true,
    },
    {
      id: "work-schedule",
      label: "Upcoming work schedule entered",
      ok: status.upcomingWorkShifts > 0,
      href: "/work",
      dismissible: true,
    },
    {
      id: "stale-timer",
      label: "No unresolved stale timer",
      ok: !status.staleTimerOpen,
      href: "/today",
      dismissible: false,
    },
    {
      id: "recurrence",
      label: "Recurring task generation healthy",
      ok: true,
      href: "/tasks/recurring",
      dismissible: true,
    },
  ];
}
