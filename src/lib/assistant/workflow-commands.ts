import { matchTasks } from "@/lib/assistant/entity-matcher";
import {
  addAppDays,
  getAppLocalDateKey,
  getDayBoundsInUtc,
  getTodayBoundsUtc,
  isOverdue,
  nowInAppTimezone,
  toUtcEndOfAppLocalDay,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import { listInboxTasks } from "@/lib/data/inbox";
import {
  getTaskFocusScheduleSummaries,
} from "@/lib/data/planning";
import { listTasks } from "@/lib/data/tasks";
import {
  listRecurrenceTemplates,
  pauseRecurrenceTemplate,
  skipRecurrenceOccurrence,
} from "@/lib/data/recurrence";
import { createClient } from "@/lib/supabase/server";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import {
  countAwaitingPlanningFeedback,
  countInboxTasks,
  countOverdueNeedingDecision,
  countWaitingFollowupsDue,
  hasCompletedReviewSession,
} from "@/lib/notifications/workflow-queries";
import { isActionableWorkload } from "@/lib/tasks/triage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecurrenceTemplate } from "@/lib/recurrence/types";
import type { TaskRow } from "@/types/domain";

export async function resolveTaskForUser(
  taskTitle: string,
  userId?: string,
): Promise<
  | { kind: "single"; task: TaskRow }
  | { kind: "multiple"; tasks: TaskRow[] }
  | { kind: "none" }
> {
  const tasks = userId
    ? await listTasksForUser(userId)
    : await listTasks({ status: "active" });
  const match = matchTasks(taskTitle, tasks);
  if (match.kind === "exact" || match.kind === "unique") {
    return { kind: "single", task: match.task };
  }
  if (match.kind === "multiple") return { kind: "multiple", tasks: match.tasks };
  return { kind: "none" };
}

async function listTasksForUser(userId: string): Promise<TaskRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["open", "in_progress", "deferred"]);
  return data ?? [];
}

export async function getInboxSummary(userId?: string) {
  if (userId) {
    const admin = createAdminClient();
    const count = await countInboxTasks(admin, userId);
    return { count, link: "/inbox" };
  }
  const tasks = await listInboxTasks();
  return { count: tasks.length, link: "/inbox" };
}

export async function getAwaitingFeedbackSummary(userId?: string) {
  const client = userId ? createAdminClient() : await createClient();
  const user = userId ? { id: userId } : await requireAllowedUser();
  const count = await countAwaitingPlanningFeedback(
    client,
    user.id,
    new Date(),
  );
  return { count, link: "/today" };
}

export async function getPendingDecisionsSummary(userId?: string) {
  const client = userId ? createAdminClient() : await createClient();
  const user = userId ? { id: userId } : await requireAllowedUser();
  const now = new Date();
  const [overdue, waiting, inbox, feedback] = await Promise.all([
    countOverdueNeedingDecision(client, user.id, now),
    countWaitingFollowupsDue(client, user.id, now),
    countInboxTasks(client, user.id),
    countAwaitingPlanningFeedback(client, user.id, now),
  ]);
  return { overdue, waiting, inbox, feedback, link: "/today" };
}

export async function getRecurringTasksSummary() {
  const templates = await listRecurrenceTemplates();
  const active = templates.filter((t) => t.is_active && !t.paused_at);
  return {
    count: active.length,
    templates: active.slice(0, 5).map((t) => t.title),
    link: "/tasks/recurring",
  };
}

export async function getUnscheduledShelfSummary() {
  const tasks = await listTasks({ status: "active" });
  const summaries = await getTaskFocusScheduleSummaries(tasks);
  const eligible = tasks.filter((task) => {
    if (!isActionableWorkload(task)) return false;
    const summary = summaries.get(task.id);
    return (summary?.unscheduledRemainingMinutes ?? 0) > 0;
  });
  return {
    count: eligible.length,
    link: "/calendar",
  };
}

export async function getHelpPlanTodaySummary() {
  const now = nowInAppTimezone();
  const dateKey = getAppLocalDateKey(now);
  const { start, end } = getTodayBoundsUtc(now);
  const supabase = await createClient();
  const user = await requireAllowedUser();

  const [{ data: events }, workload, inboxCount] = await Promise.all([
    supabase
      .from("events")
      .select("id")
      .eq("user_id", user.id)
      .gte("start_at", start.toISOString())
      .lte("start_at", end.toISOString()),
    import("@/lib/data/workload").then((m) =>
      m.getCachedWorkload({ periodType: "day" }),
    ),
    countInboxTasks(supabase, user.id),
  ]);

  return {
    dateKey,
    eventCount: events?.length ?? 0,
    workloadStatus: workload.status,
    inboxCount,
    link: "/today",
  };
}

export async function previewUnfinishedRollover(targetDateKey: string) {
  const bounds = getDayBoundsInUtc(targetDateKey);
  const tasks = await listTasks({ status: "active" });
  const summaries = await getTaskFocusScheduleSummaries(tasks);

  const previews = tasks
    .filter((task) => {
      if (!isActionableWorkload(task)) return false;
      const summary = summaries.get(task.id);
      return (summary?.unscheduledRemainingMinutes ?? 0) > 0;
    })
    .slice(0, 8)
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      remainingMinutes:
        summaries.get(task.id)?.unscheduledRemainingMinutes ?? null,
      suggestedDateKey: addAppDays(targetDateKey, 1),
    }));

  return {
    sourceDateKey: targetDateKey,
    periodEnd: bounds.end.toISOString(),
    previews,
  };
}

export async function recordKeepOverdueDecision(taskId: string) {
  const user = await requireAllowedUser();
  const admin = createAdminClient() as ReturnType<typeof createAdminClient> &
    SupabaseClient<Record<string, unknown>>;
  const dateKey = getAppLocalDateKey(new Date());

  const { data: session } = await admin
    .from("review_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("review_type", "evening_daily")
    .eq("review_date", dateKey)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (session && typeof session === "object" && "id" in session && session.id) {
    await admin.from("review_decisions").insert({
      user_id: user.id,
      session_id: session.id,
      task_id: taskId,
      decision_type: "keep_due",
      decision_payload: { kept_overdue_at: new Date().toISOString() },
    });
  }
}

export async function resolveRecurrenceTemplate(
  templateTitle?: string,
): Promise<RecurrenceTemplate | null> {
  const templates = await listRecurrenceTemplates();
  if (!templateTitle) {
    return templates.find((t) => t.is_active && !t.paused_at) ?? null;
  }
  const normalized = templateTitle.toLowerCase().trim();
  const exact = templates.find(
    (t) => t.title.toLowerCase() === normalized,
  );
  if (exact) return exact;
  return (
    templates.find((t) => t.title.toLowerCase().includes(normalized)) ?? null
  );
}

export async function executePauseRecurringTask(templateId: string) {
  await pauseRecurrenceTemplate(templateId);
}

export async function executeSkipRecurrenceOccurrence(
  templateId: string,
  occurrenceDate: string,
) {
  await skipRecurrenceOccurrence(templateId, occurrenceDate);
}

export async function isWeeklyReviewIncomplete(userId: string) {
  const now = nowInAppTimezone();
  const dateKey = getAppLocalDateKey(now);
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("week_starts_on")
    .eq("id", userId)
    .single();
  const weekStartsOn = (profile?.week_starts_on ?? 0) as 0 | 1;
  const weekStart = toUtcFromAppLocalDate(dateKey);
  const { getWeekBounds } = await import("@/lib/dates/timezone");
  const { start } = getWeekBounds(now, weekStartsOn, 0);
  const weekStartKey = getAppLocalDateKey(start);
  const completed = await hasCompletedReviewSession(admin, userId, "weekly", {
    weekStartKey,
  });
  return !completed;
}

export function formatRolloverTargetEnd(targetDateKey: string): string {
  return toUtcEndOfAppLocalDay(targetDateKey).toISOString();
}

export function isTaskOverdue(task: TaskRow, now = new Date()): boolean {
  return task.due_at ? isOverdue(task.due_at, now) : false;
}
