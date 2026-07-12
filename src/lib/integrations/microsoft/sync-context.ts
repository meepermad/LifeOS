import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type MicrosoftSyncTrigger = "manual" | "scheduled";

export type MicrosoftSyncContext = {
  client: SupabaseClient<Database>;
  userId: string;
};

export async function createSessionSyncContext(): Promise<MicrosoftSyncContext> {
  const user = await requireAllowedUser();
  return {
    client: await createClient(),
    userId: user.id,
  };
}
