"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateCalendarVisibilityAction } from "@/lib/actions/settings";
import type { CalendarRow } from "@/types/domain";

export function CalendarsSettings({ calendars }: { calendars: CalendarRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleVisibility(calendarId: string, isVisible: boolean) {
    startTransition(async () => {
      await updateCalendarVisibilityAction(calendarId, isVisible);
      router.refresh();
    });
  }

  return (
    <ul className="space-y-3">
      {calendars.map((calendar) => (
        <li
          key={calendar.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border/70 p-3"
        >
          <div>
            <p className="font-medium text-foreground">{calendar.name}</p>
            <p className="mt-1 text-xs text-muted">
              Source: {calendar.source}
              {" · "}
              {calendar.is_writable ? "Writable" : "Read-only"}
              {" · "}
              Sync {calendar.sync_enabled ? "enabled" : "disabled"}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={calendar.is_visible}
              disabled={isPending}
              onChange={(event) =>
                toggleVisibility(calendar.id, event.target.checked)
              }
              aria-label={`Toggle visibility for ${calendar.name}`}
              className="h-4 w-4 rounded border-border"
            />
            Visible
          </label>
        </li>
      ))}
    </ul>
  );
}
