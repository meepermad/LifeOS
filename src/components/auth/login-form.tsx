"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type LoginFormProps = {
  nextPath: string;
  initialError?: string | null;
};

export function LoginForm({ nextPath, initialError }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    window.location.href = nextPath;
  }

  async function handleMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setMessage("Check your email for a sign-in link.");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground outline-none focus:border-accent"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm text-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground outline-none focus:border-accent"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <button
        type="button"
        disabled={loading || !email}
        onClick={handleMagicLink}
        className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
      >
        Send magic link instead
      </button>
    </form>
  );
}
