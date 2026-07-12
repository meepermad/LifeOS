import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  AuthenticationError,
  AuthorizationError,
} from "@/lib/errors/app-error";
import { getAllowedEmail } from "@/lib/security/env";

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  return user?.id ?? null;
}

export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) {
    return false;
  }

  return email.toLowerCase() === getAllowedEmail();
}

export async function requireUser(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}

export async function requireAllowedUser(): Promise<User> {
  const user = await requireUser();

  if (!isAllowedEmail(user.email)) {
    throw new AuthorizationError(
      "This account is not authorized to access LifeOS",
    );
  }

  return user;
}
