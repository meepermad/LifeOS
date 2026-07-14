import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { getProfile } from "@/lib/data/bootstrap";
import { errorResponse } from "@/lib/errors/error-response";
import { exportHeaders, privateNoStoreHeaders } from "@/lib/export/headers";
import { buildIcsCalendar } from "@/lib/export/ics";
import { allowExport } from "@/lib/export/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const user = await requireAllowedUser();
    if (!allowExport(user.id)) {
      return new Response("Too many export requests", {
        status: 429,
        headers: privateNoStoreHeaders(),
      });
    }

    const requestedCalendarIds = new URL(request.url).searchParams
      .get("calendars")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const supabase = await createClient();
    let calendarQuery = supabase
      .from("calendars")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_visible", true);
    if (requestedCalendarIds?.length) {
      calendarQuery = calendarQuery.in("id", requestedCalendarIds);
    }
    const { data: calendars, error: calendarError } = await calendarQuery;
    if (calendarError) throw calendarError;

    const calendarIds = (calendars ?? []).map((calendar) => calendar.id);
    const [{ data: events, error: eventsError }, { data: profiles, error: profilesError }, profile] =
      await Promise.all([
        calendarIds.length
          ? supabase
              .from("events")
              .select("*")
              .eq("user_id", user.id)
              .in("calendar_id", calendarIds)
              .neq("status", "cancelled")
              .order("start_at")
              .limit(5000)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("work_profiles")
          .select("id, display_name")
          .eq("user_id", user.id)
          .limit(5000),
        getProfile(),
      ]);
    if (eventsError) throw eventsError;
    if (profilesError) throw profilesError;

    const profileLabels = new Map((profiles ?? []).map((item) => [item.id, item.display_name]));
    const body = buildIcsCalendar(
      (events ?? []).map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startAt: event.start_at,
        endAt: event.end_at,
        allDay: event.all_day,
        status: event.status,
        workProfileLabel: event.work_profile_id
          ? profileLabels.get(event.work_profile_id) ?? null
          : null,
      })),
      profile.timezone,
    );
    return new Response(body, {
      headers: exportHeaders("lifeos-calendar.ics", "text/calendar"),
    });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
