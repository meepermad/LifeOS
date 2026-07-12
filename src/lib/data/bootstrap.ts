import { DEFAULT_CALENDARS, normalizeEmail } from "@/lib/constants";
import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { CalendarRow, ProfileRow } from "@/types/domain";

export type InitializationResult = {
  profile: ProfileRow;
  calendars: CalendarRow[];
};

export async function ensureUserInitialized(): Promise<InitializationResult> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const email = normalizeEmail(user.email ?? "");

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      email,
    });

    if (profileError) {
      throw new DatabaseError("Failed to create profile");
    }
  } else if (existingProfile.email !== email) {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ email })
      .eq("id", user.id);

    if (profileUpdateError) {
      throw new DatabaseError("Failed to update profile email");
    }
  }

  const { error: preferencesError } = await supabase
    .from("planning_preferences")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  if (preferencesError) {
    throw new DatabaseError("Failed to ensure planning preferences");
  }

  for (const calendar of DEFAULT_CALENDARS) {
    const { error: calendarError } = await supabase.from("calendars").upsert(
      {
        user_id: user.id,
        name: calendar.name,
        source: calendar.source,
        is_writable: calendar.is_writable,
        is_visible: calendar.is_visible,
        sync_enabled: calendar.sync_enabled,
      },
      { onConflict: "user_id,name", ignoreDuplicates: true },
    );

    if (calendarError) {
      throw new DatabaseError(`Failed to ensure calendar: ${calendar.name}`);
    }
  }

  const [{ data: profile, error: profileFetchError }, { data: calendars, error: calendarsError }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("calendars").select("*").eq("user_id", user.id).order("name"),
    ]);

  if (profileFetchError || !profile) {
    throw new DatabaseError("Failed to load profile after initialization");
  }

  if (calendarsError || !calendars) {
    throw new DatabaseError("Failed to load calendars after initialization");
  }

  return { profile, calendars };
}

export async function getProfile(): Promise<ProfileRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    throw new DatabaseError("Profile not found");
  }

  return data;
}

export async function updateProfileSettings(input: {
  weekStartsOn: 0 | 1;
}): Promise<ProfileRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({ week_starts_on: input.weekStartsOn })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update profile");
  }

  return data;
}
