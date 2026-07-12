import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type CanvasSyncTrigger = "manual" | "scheduled";

export type CanvasSyncContext = {
  client: SupabaseClient<Database>;
  userId: string;
};

export async function createSessionSyncContext(): Promise<CanvasSyncContext> {
  const user = await requireAllowedUser();
  return {
    client: await createClient(),
    userId: user.id,
  };
}
