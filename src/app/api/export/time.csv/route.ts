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
    const { data, error } = await supabase
      .from("task_time_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at")
      .limit(5000);
    if (error) throw error;

    const body = buildCsv(
      ["task", "start", "end", "reviewed duration", "source", "review state"],
      (data ?? []).map((entry) => [
        entry.task_title_snapshot,
        entry.started_at,
        entry.ended_at,
        entry.duration_seconds,
        entry.entry_source,
        entry.review_state,
      ]),
    );
    return new Response(body, {
      headers: exportHeaders("lifeos-time.csv", "text/csv"),
    });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
