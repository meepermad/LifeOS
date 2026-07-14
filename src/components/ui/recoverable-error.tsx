"use client";

import Link from "next/link";
import { useEffect } from "react";
import { classifyRouteError } from "@/lib/ui/feedback-copy";

export function RecoverableError({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  const kind = classifyRouteError(error);

  useEffect(() => {
    console.error("[lifeos:route-error]", {
      digest: error.digest ?? null,
      kind,
    });
  }, [error.digest, kind]);

  const description =
    kind === "connection"
      ? "Could not reach LifeOS. Check your connection and try again."
      : kind === "authorization"
        ? "You are not authorized to view this page. Sign in again if needed."
        : "This section could not be loaded. Your navigation remains available.";

  return (
    <div
      className="space-y-4 rounded-xl border border-danger/30 bg-danger/5 p-6"
      role="alert"
    >
      <div>
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Retry
        </button>
        <Link
          href="/today"
          className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:border-accent hover:text-foreground"
        >
          Back to Today
        </Link>
      </div>
    </div>
  );
}
