import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { errorResponse } from "@/lib/errors/error-response";
import { buildCsv } from "@/lib/export/csv";
import { exportHeaders, privateNoStoreHeaders } from "@/lib/export/headers";
import { allowExport } from "@/lib/export/rate-limit";
import { createClient } from "@/lib/supabase/server";

function datePart(value: string): string {
  return value.slice(0, 10);
}

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
    const [{ data: shifts, error: shiftError }, { data: profiles, error: profileError }] =
      await Promise.all([
        supabase
          .from("events")
          .select("*")
          .eq("user_id", user.id)
          .eq("event_type", "work")
          .neq("status", "cancelled")
          .order("start_at")
          .limit(5000),
        supabase
          .from("work_profiles")
          .select("id, employer_name, role_title")
          .eq("user_id", user.id)
          .limit(5000),
      ]);
    if (shiftError) throw shiftError;
    if (profileError) throw profileError;

    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const body = buildCsv(
      ["employer", "role", "date", "start", "end", "break", "scheduled hours", "location"],
      (shifts ?? []).map((shift) => {
        const profile = shift.work_profile_id
          ? profilesById.get(shift.work_profile_id)
          : undefined;
        const scheduledHours = Math.max(
          0,
          (new Date(shift.end_at).getTime() -
            new Date(shift.start_at).getTime() -
            shift.unpaid_break_minutes * 60_000) /
            3_600_000,
        );
        return [
          profile?.employer_name ?? "Unassigned",
          profile?.role_title ?? "Unassigned",
          datePart(shift.start_at),
          shift.start_at,
          shift.end_at,
          shift.unpaid_break_minutes,
          scheduledHours,
          shift.location,
        ];
      }),
    );
    return new Response(body, {
      headers: exportHeaders("lifeos-work.csv", "text/csv"),
    });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
