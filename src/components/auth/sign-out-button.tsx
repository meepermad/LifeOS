"use client";

import { createClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger hover:text-danger"
    >
      Sign out
    </button>
  );
}
