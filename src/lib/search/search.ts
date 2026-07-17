import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import {
  matchLocalCommands,
  normalizeSearchQuery,
  SEARCH_RESULTS_PER_CATEGORY,
  type SearchResult,
} from "@/lib/search/types";
import { getWorkCalendar } from "@/lib/data/calendars";

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export async function searchLifeOs(rawQuery: string): Promise<SearchResult[]> {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) {
    return matchLocalCommands("");
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();
  const pattern = `%${escapeIlike(query)}%`;
  const limit = SEARCH_RESULTS_PER_CATEGORY;
  const workCalendar = await getWorkCalendar();

  const [
    tasksResult,
    eventsResult,
    coursesResult,
    termsResult,
    profilesResult,
    templatesResult,
    notificationsResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("user_id", user.id)
      .ilike("title", pattern)
      .neq("status", "cancelled")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("events")
      .select("id, title, start_at, event_type, calendar_id")
      .eq("user_id", user.id)
      .ilike("title", pattern)
      .neq("status", "cancelled")
      .order("start_at", { ascending: false })
      .limit(limit * 2),
    supabase
      .from("courses")
      .select("id, name, code")
      .eq("user_id", user.id)
      .ilike("name", pattern)
      .limit(limit),
    supabase
      .from("academic_terms")
      .select("id, name, status")
      .eq("user_id", user.id)
      .ilike("name", pattern)
      .limit(limit),
    supabase
      .from("work_profiles")
      .select("id, display_name, employer_name")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .ilike("display_name", pattern)
      .limit(limit),
    supabase
      .from("task_recurrence_templates")
      .select("id, title, is_active")
      .eq("user_id", user.id)
      .ilike("title", pattern)
      .limit(limit),
    supabase
      .from("notification_deliveries")
      .select("id, notification_type, status, scheduled_for")
      .eq("user_id", user.id)
      .ilike("notification_type", pattern)
      .order("scheduled_for", { ascending: false })
      .limit(limit),
  ]);

  const results: SearchResult[] = [...matchLocalCommands(query)];

  for (const task of tasksResult.data ?? []) {
    results.push({
      id: `task-${task.id}`,
      category: "task",
      title: task.title,
      subtitle: task.status,
      href: `/tasks/${task.id}/edit`,
    });
  }

  let eventCount = 0;
  let shiftCount = 0;
  for (const event of eventsResult.data ?? []) {
    const isWorkShift =
      event.event_type === "work" ||
      (workCalendar != null && event.calendar_id === workCalendar.id);
    const dateKey = event.start_at.slice(0, 10);

    if (isWorkShift) {
      if (shiftCount >= limit) continue;
      shiftCount += 1;
      results.push({
        id: `shift-${event.id}`,
        category: "work_shift",
        title: event.title,
        subtitle: "Work shift",
        href: `/work?date=${dateKey}&event=${event.id}`,
      });
      continue;
    }

    if (eventCount >= limit) continue;
    eventCount += 1;
    results.push({
      id: `event-${event.id}`,
      category: "event",
      title: event.title,
      subtitle: event.event_type,
      href: `/calendar?date=${dateKey}&event=${event.id}`,
    });
  }

  for (const course of coursesResult.data ?? []) {
    results.push({
      id: `course-${course.id}`,
      category: "course",
      title: course.name,
      subtitle: course.code ?? undefined,
      href: `/school`,
    });
  }

  for (const term of termsResult.data ?? []) {
    results.push({
      id: `term-${term.id}`,
      category: "term",
      title: term.name,
      subtitle: term.status,
      href: `/school`,
    });
  }

  for (const profile of profilesResult.data ?? []) {
    results.push({
      id: `profile-${profile.id}`,
      category: "work_profile",
      title: profile.display_name,
      subtitle: profile.employer_name,
      href: `/work`,
    });
  }

  for (const template of templatesResult.data ?? []) {
    results.push({
      id: `recurrence-${template.id}`,
      category: "recurring_template",
      title: template.title,
      subtitle: template.is_active ? "Active" : "Paused",
      href: `/tasks/recurring`,
    });
  }

  for (const delivery of notificationsResult.data ?? []) {
    results.push({
      id: `notification-${delivery.id}`,
      category: "notification",
      title: delivery.notification_type.replaceAll("_", " "),
      subtitle: delivery.status,
      href: `/settings/notifications`,
    });
  }

  return results;
}
