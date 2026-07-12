import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/today";
  const initialError =
    params.error === "unauthorized"
      ? "This account is not authorized to access LifeOS."
      : null;

  return (
    <main className="safe-top safe-bottom flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white">
            L
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">LifeOS</h1>
          <p className="mt-2 text-sm text-muted">
            Private personal planning
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <LoginForm nextPath={nextPath} initialError={initialError} />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Access is restricted to the configured account only.
        </p>
      </div>
    </main>
  );
}
