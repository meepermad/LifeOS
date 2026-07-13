import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { DatabaseError } from "@/lib/errors/app-error";
import type { TaskRow } from "@/types/domain";
import { listActiveCanvasLinkDecisions } from "@/lib/data/academic/canvas-links";

export type CourseResolution = {
  courseId: string | null;
  method: "task_course_id" | "canvas_link" | "none";
};

export async function resolveTaskCourseId(
  task: Pick<TaskRow, "id" | "course_id" | "source" | "related_event_id">,
): Promise<CourseResolution> {
  if (task.course_id) {
    return { courseId: task.course_id, method: "task_course_id" };
  }

  if (task.source !== "canvas" || !task.related_event_id) {
    return { courseId: null, method: "none" };
  }

  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, class_meeting_id, calendar_id")
    .eq("id", task.related_event_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (eventError || !event) {
    return { courseId: null, method: "none" };
  }

  let canvasCourseId: string | null = null;

  if (event.class_meeting_id) {
    const { data: meeting } = await supabase
      .from("class_meetings")
      .select("course_id")
      .eq("id", event.class_meeting_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (meeting?.course_id) {
      return { courseId: meeting.course_id, method: "canvas_link" };
    }
  }

  const { data: eventMeta } = await supabase
    .from("events")
    .select("external_event_id, description")
    .eq("id", task.related_event_id)
    .eq("user_id", user.id)
    .maybeSingle();

  canvasCourseId = extractCanvasCourseId(eventMeta?.external_event_id);
  if (!canvasCourseId) {
    return { courseId: null, method: "none" };
  }

  const { data: terms } = await supabase
    .from("academic_terms")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active");

  const activeTermIds = (terms ?? []).map((t) => t.id);
  if (activeTermIds.length === 0) {
    return { courseId: null, method: "none" };
  }

  for (const termId of activeTermIds) {
    const decisions = await listActiveCanvasLinkDecisions(termId);
    const matching = decisions.filter(
      (d) =>
        d.canvas_course_id === canvasCourseId &&
        d.class_meeting_id != null &&
        (d.resolution_mode === "link_suppress" || d.resolution_mode === "link_only"),
    );

    if (matching.length !== 1) continue;

    const { data: linkedMeeting } = await supabase
      .from("class_meetings")
      .select("course_id")
      .eq("id", matching[0].class_meeting_id!)
      .eq("user_id", user.id)
      .maybeSingle();

    if (linkedMeeting?.course_id) {
      return { courseId: linkedMeeting.course_id, method: "canvas_link" };
    }
  }

  return { courseId: null, method: "none" };
}

function extractCanvasCourseId(externalEventId: string | null | undefined): string | null {
  if (!externalEventId) return null;
  const match = externalEventId.match(/course[_-]?(\d+)/i);
  return match ? match[1] : null;
}

export async function backfillCanvasTaskCourseIds(): Promise<number> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, course_id, source, related_event_id")
    .eq("user_id", user.id)
    .eq("source", "canvas")
    .is("course_id", null);

  if (error) {
    throw new DatabaseError("Failed to load canvas tasks for backfill");
  }

  let updated = 0;
  for (const task of tasks ?? []) {
    const resolution = await resolveTaskCourseId(task);
    if (!resolution.courseId) continue;

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ course_id: resolution.courseId })
      .eq("id", task.id)
      .eq("user_id", user.id);

    if (!updateError) updated += 1;
  }

  return updated;
}
