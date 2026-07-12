import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerEnv, getSupabasePublicEnv } from "@/lib/security/env";
import { ConfigurationError } from "@/lib/errors/app-error";

/**
 * Service-role client for trusted server operations only.
 * Never import this module from client components.
 */
export function createAdminClient() {
  const serviceRoleKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new ConfigurationError(
      "SUPABASE_SERVICE_ROLE_KEY is not configured",
    );
  }

  const env = getSupabasePublicEnv();

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
