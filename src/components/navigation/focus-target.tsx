"use client";

import { useEffect, useRef } from "react";

/**
 * Scrolls and briefly highlights a focused entity from a notification deep link.
 */
export function FocusTarget({
  focusId,
  unavailableMessage,
}: {
  focusId: string | null;
  unavailableMessage?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusId || !ref.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId]);

  if (unavailableMessage) {
    return (
      <div
        role="status"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted"
      >
        {unavailableMessage}
      </div>
    );
  }

  if (!focusId) return null;

  return (
    <div
      ref={ref}
      data-focus-id={focusId}
      className="pointer-events-none absolute"
      aria-hidden
    />
  );
}

export function useScrollToFocusId(focusId: string | null | undefined) {
  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector(`[data-focus-id="${CSS.escape(focusId)}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-accent");
      const timer = window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-accent");
      }, 2500);
      return () => window.clearTimeout(timer);
    }
  }, [focusId]);
}
