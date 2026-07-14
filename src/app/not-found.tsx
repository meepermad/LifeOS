import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-xs uppercase tracking-wider text-muted">LifeOS</p>
      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-muted">
        That route does not exist or is no longer available.
      </p>
      <Link
        href="/today"
        className="mt-6 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Back to Today
      </Link>
    </div>
  );
}
