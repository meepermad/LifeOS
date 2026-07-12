import { z } from "zod";

const middlewareEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  APP_ALLOWED_EMAIL: z.string().email(),
});

export type MiddlewareEnv = z.infer<typeof middlewareEnvSchema>;

export type MiddlewareEnvResult =
  | { success: true; data: MiddlewareEnv }
  | { success: false };

export function parseMiddlewareEnv(): MiddlewareEnvResult {
  const result = middlewareEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    APP_ALLOWED_EMAIL: process.env.APP_ALLOWED_EMAIL,
  });

  if (!result.success) {
    return { success: false };
  }

  return { success: true, data: result.data };
}
