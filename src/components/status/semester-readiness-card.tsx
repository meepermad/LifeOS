"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReadinessCheck } from "@/lib/status/system-status";
import { SectionCard } from "@/components/forms/ui";

const DISMISS_KEY = "lifeos:readiness-dismissed";

function statusGlyph(check: ReadinessCheck): string {
  if (check.ok) return "✅";
  if (check.severity === "warning") return "⚠";
  return "❌";
}

export function SemesterReadinessCard({
  checks,
  forceShow = false,
}: {
  checks: ReadinessCheck[];
  forceShow?: boolean;
}) {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });

  const visible = useMemo(
    () => checks.filter((check) => !dismissed.includes(check.id)),
    [checks, dismissed],
  );

  const failing = visible.filter((check) => !check.ok);
  if (!forceShow && failing.length === 0) {
    return null;
  }

  function dismiss(id: string) {
    const next = [...new Set([...dismissed, id])];
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  }

  return (
    <SectionCard
      title="Semester readiness"
      description="Setup diagnostics with clear next steps. Dismiss items that do not apply."
    >
      <ul className="space-y-3">
        {visible.map((check) => (
          <li
            key={check.id}
            className="rounded-lg border border-border px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p
                  className={
                    check.ok
                      ? "font-medium text-success"
                      : check.severity === "warning"
                        ? "font-medium text-warning"
                        : "font-medium text-danger"
                  }
                >
                  <span aria-hidden="true">{statusGlyph(check)} </span>
                  {check.label}
                </p>
                {!check.ok ? (
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    <p>
                      <span className="font-medium text-foreground">
                        Why it matters:{" "}
                      </span>
                      {check.why}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        How to fix:{" "}
                      </span>
                      {check.howToFix}
                    </p>
                    <p>About {check.estimatedMinutes} min</p>
                    <Link
                      href={check.href}
                      className="inline-flex min-h-11 items-center text-accent hover:text-accent-hover"
                    >
                      Open fix →
                    </Link>
                  </div>
                ) : null}
              </div>
              {check.dismissible && !check.ok ? (
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted hover:text-foreground"
                  onClick={() => dismiss(check.id)}
                >
                  Mark unused
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
