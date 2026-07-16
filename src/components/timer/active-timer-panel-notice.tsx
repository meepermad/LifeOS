"use client";

import { useEffect, useState } from "react";
import { getActiveTimerAction } from "@/lib/actions/timer";

export function ActiveTimerPanelNotice({
  panel,
}: {
  panel?: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (panel !== "active-timer") return;

    let cancelled = false;
    (async () => {
      const result = await getActiveTimerAction();
      if (cancelled) return;
      if (!result.success || !result.data) {
        setMessage("No active timer right now.");
        return;
      }
      const bar = document.querySelector("[data-persistent-timer]");
      if (bar instanceof HTMLElement) {
        bar.scrollIntoView({ behavior: "smooth", block: "end" });
        bar.classList.add("ring-2", "ring-accent");
        window.setTimeout(() => {
          bar.classList.remove("ring-2", "ring-accent");
        }, 2500);
      }
      setMessage(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [panel]);

  if (!message) return null;

  return (
    <p
      role="status"
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted"
    >
      {message}
    </p>
  );
}
