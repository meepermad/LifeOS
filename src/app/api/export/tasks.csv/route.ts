import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { errorResponse } from "@/lib/errors/error-response";
import { buildCsv } from "@/lib/export/csv";
import { exportHeaders, privateNoStoreHeaders } from "@/lib/export/headers";
import { allowExport } from "@/lib/export/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireAllowedUser();
    if (!allowExport(user.id)) {
      return new Response("Too many export requests", {
        status: 429,
        headers: privateNoStoreHeaders(),
      });
    }
    const supabase = await createClient();
    const [{ data: tasks, error: taskError }, { data: courses, error: courseError }] =
      await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at").limit(5000),
        supabase.from("courses").select("id, name").eq("user_id", user.id).limit(5000),
      ]);
    if (taskError) throw taskError;
    if (courseError) throw courseError;

    const coursesById = new Map((courses ?? []).map((course) => [course.id, course.name]));
    const body = buildCsv(
      [
        "title",
        "status",
        "due date",
        "estimate",
        "reviewed actual time",
        "course/category",
        "workflow state",
        "completion date",
      ],
      (tasks ?? []).map((task) => [
        task.title,
        task.status,
        task.due_at,
        task.estimated_minutes,
        task.actual_minutes,
        task.course_id ? coursesById.get(task.course_id) ?? "" : "",
        task.workflow_state,
        task.completed_at,
      ]),
    );
    return new Response(body, {
      headers: exportHeaders("lifeos-tasks.csv", "text/csv"),
    });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
