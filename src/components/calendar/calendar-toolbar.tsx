"use client";

import type { CalendarViewId } from "@/lib/calendar/types";
import { CALENDAR_VIEW_LABELS } from "@/lib/calendar/types";
import { SecondaryButton } from "@/components/forms/ui";

type CalendarToolbarProps = {
  currentLabel: string;
  currentView: CalendarViewId;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarViewId) => void;
  onDateChange: (dateKey: string) => void;
  anchorDate: string;
};

const VIEWS: CalendarViewId[] = ["month", "week", "threeDay", "day", "agenda"];

export function CalendarToolbar({
  currentLabel,
  currentView,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onDateChange,
  anchorDate,
}: CalendarToolbarProps) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SecondaryButton type="button" onClick={onPrev} aria-label="Previous period">
            ←
          </SecondaryButton>
          <SecondaryButton type="button" onClick={onToday}>
            Today
          </SecondaryButton>
          <SecondaryButton type="button" onClick={onNext} aria-label="Next period">
            →
          </SecondaryButton>
        </div>
        <h1 className="text-sm font-medium text-foreground sm:text-base">{currentLabel}</h1>
        <input
          type="date"
          value={anchorDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          aria-label="Jump to date"
        />
      </div>

      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label="Calendar view"
      >
        {VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={currentView === view}
            onClick={() => onViewChange(view)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              currentView === view
                ? "bg-accent text-background"
                : "bg-surface-elevated text-muted hover:text-foreground"
            }`}
          >
            {CALENDAR_VIEW_LABELS[view]}
          </button>
        ))}
      </div>
    </div>
  );
}
