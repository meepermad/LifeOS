import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/security/env";
import type { Database } from "@/types/database.types";

export type BrowserSupabaseClient = SupabaseClient<Database>;

export function createClient(): BrowserSupabaseClient {
  const env = getSupabasePublicEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ) as unknown as BrowserSupabaseClient;
}
