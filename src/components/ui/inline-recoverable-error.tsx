"use client";

export function InlineRecoverableError({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="space-y-3" role="alert">
      <div>
        <p className="text-sm font-medium text-danger">{message}</p>
        <p className="mt-1 text-xs text-muted">
          {hint ?? "Something went wrong loading this section. You can retry."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:border-accent"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
        >
          Retry
        </button>
        <a
          href="/today"
          className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Back to Today
        </a>
      </div>
    </div>
  );
}
