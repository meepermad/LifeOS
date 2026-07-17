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
  severity: "ok" | "warning" | "error";
  why: string;
  howToFix: string;
  estimatedMinutes: number;
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
      .is("ended_at", null)
      .lt("end_date", now.toISOString().slice(0, 10)),
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
  const canvasRecent = Boolean(
    status.canvasLastSuccessAt &&
      Date.now() - new Date(status.canvasLastSuccessAt).getTime() <
        7 * 24 * 60 * 60 * 1000,
  );

  return [
    {
      id: "active-term",
      label: "Active semester detected",
      ok: Boolean(status.activeTermName),
      href: "/school",
      dismissible: true,
      severity: status.activeTermName ? "ok" : "error",
      why: "School planning, class meetings, and Canvas review need an active academic term.",
      howToFix: "Open School and create or activate a semester with start and end dates.",
      estimatedMinutes: 3,
    },
    {
      id: "term-current",
      label: status.activeTermCurrent
        ? "Semester dates are current"
        : "Semester dates are out of range",
      ok: status.activeTermCurrent,
      href: "/school",
      dismissible: true,
      severity: status.activeTermCurrent ? "ok" : "warning",
      why: "Today falls outside the active semester window, so class schedules may look empty.",
      howToFix: "Update the active semester dates or switch to the current term.",
      estimatedMinutes: 2,
    },
    {
      id: "courses",
      label:
        status.courseCount > 0
          ? "Courses configured"
          : "No courses configured",
      ok: status.courseCount > 0,
      href: "/school",
      dismissible: true,
      severity: status.courseCount > 0 ? "ok" : "error",
      why: "Courses drive class meetings, Canvas mapping, and school workload.",
      howToFix: "Add at least one course to the active semester.",
      estimatedMinutes: 5,
    },
    {
      id: "canvas",
      label: status.canvasConnected
        ? "Canvas connected"
        : "Canvas not connected",
      ok: status.canvasConnected,
      href: "/imports",
      dismissible: true,
      severity: status.canvasConnected ? "ok" : "warning",
      why: "Without Canvas, assignment deadlines will not sync automatically.",
      howToFix: "Connect Canvas from Imports and complete the token setup.",
      estimatedMinutes: 5,
    },
    {
      id: "canvas-recent",
      label: canvasRecent
        ? "Canvas synced recently"
        : "Canvas sync is stale",
      ok: canvasRecent,
      href: "/imports",
      dismissible: true,
      severity: canvasRecent ? "ok" : "warning",
      why: "A stale Canvas sync means new deadlines may be missing from Today and Calendar.",
      howToFix: "Run a Canvas sync from Imports and confirm the last success time.",
      estimatedMinutes: 2,
    },
    {
      id: "push",
      label:
        status.devicePushCount > 0
          ? "Push notifications enabled"
          : "Push notifications not enabled",
      ok: status.devicePushCount > 0,
      href: "/settings/notifications",
      dismissible: true,
      severity: status.devicePushCount > 0 ? "ok" : "warning",
      why: "Review prompts and deadline reminders require an active push subscription.",
      howToFix: "Enable Web Push on this device in Notification settings.",
      estimatedMinutes: 2,
    },
    {
      id: "work-profiles",
      label:
        status.workProfilesConfigured > 0
          ? "Work profile configured"
          : "Work profile missing",
      ok: status.workProfilesConfigured > 0,
      href: "/work",
      dismissible: true,
      severity: status.workProfilesConfigured > 0 ? "ok" : "warning",
      why: "Work shifts attach to a profile so hours and imports stay organized.",
      howToFix: "Create a work profile on the Work page.",
      estimatedMinutes: 3,
    },
    {
      id: "work-schedule",
      label:
        status.upcomingWorkShifts > 0
          ? "Upcoming work schedule present"
          : "No upcoming work shifts",
      ok: status.upcomingWorkShifts > 0,
      href: "/work",
      dismissible: true,
      severity: status.upcomingWorkShifts > 0 ? "ok" : "warning",
      why: "Without upcoming shifts, workload and Today miss your work hours.",
      howToFix: "Import or enter shifts for the next week on Work.",
      estimatedMinutes: 5,
    },
    {
      id: "stale-timer",
      label: status.staleTimerOpen
        ? "Stale timer needs review"
        : "No stale timer",
      ok: !status.staleTimerOpen,
      href: "/today?panel=active-timer",
      dismissible: false,
      severity: status.staleTimerOpen ? "error" : "ok",
      why: "A timer left running for many hours skews tracked time and reviews.",
      howToFix: "Open the active timer panel and stop, discard, or review the entry.",
      estimatedMinutes: 2,
    },
    {
      id: "recurrence",
      label:
        status.recurringNeedingGeneration > 0
          ? "Recurring templates need cleanup"
          : "Recurring task generation healthy",
      ok: status.recurringNeedingGeneration === 0,
      href: "/tasks/recurring",
      dismissible: true,
      severity:
        status.recurringNeedingGeneration > 0 ? "warning" : "ok",
      why: "Active templates past their end date keep generating noise or block generation health.",
      howToFix: "Pause, archive, or update end dates on overdue recurring templates.",
      estimatedMinutes: 4,
    },
  ];
}
