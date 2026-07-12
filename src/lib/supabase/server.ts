import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/security/env";
import type { Database } from "@/types/database.types";

export type ServerSupabaseClient = SupabaseClient<Database>;

function buildServerSupabaseClient(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): ServerSupabaseClient {
  const env = getPublicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll can fail in Server Components; middleware handles refresh.
          }
        },
      },
    },
  ) as unknown as ServerSupabaseClient;
}

export async function createClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();
  return buildServerSupabaseClient(cookieStore);
}
