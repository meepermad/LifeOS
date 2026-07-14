"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReadinessCheck } from "@/lib/status/system-status";
import { SectionCard } from "@/components/forms/ui";

const DISMISS_KEY = "lifeos:readiness-dismissed";

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
      description="Automatically derived setup checks. Dismiss items that do not apply."
    >
      <ul className="space-y-2">
        {visible.map((check) => (
          <li
            key={check.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <div>
              <p className={check.ok ? "text-success" : "text-warning"}>
                {check.ok ? "Ready" : "Needs attention"} · {check.label}
              </p>
              {!check.ok ? (
                <Link href={check.href} className="text-xs text-accent">
                  Open repair workflow
                </Link>
              ) : null}
            </div>
            {check.dismissible && !check.ok ? (
              <button
                type="button"
                className="text-xs text-muted hover:text-foreground"
                onClick={() => dismiss(check.id)}
              >
                Mark unused
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
