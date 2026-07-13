"use client";

import type { CalendarFilterPrefs } from "@/lib/calendar/types";
import { DEFAULT_CALENDAR_FILTER_PREFS } from "@/lib/calendar/types";

type CalendarFiltersProps = {
  filters: CalendarFilterPrefs;
  onChange: (filters: CalendarFilterPrefs) => void;
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-border"
      />
      {label}
    </label>
  );
}

export function CalendarFilters({ filters, onChange }: CalendarFiltersProps) {
  const merged = { ...DEFAULT_CALENDAR_FILTER_PREFS, ...filters };

  const set = (patch: Partial<CalendarFilterPrefs>) => {
    onChange({ ...merged, ...patch });
  };

  return (
    <details className="mb-4 rounded-lg border border-border bg-surface p-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Filters
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Toggle
          label="Classes"
          checked={merged.showClasses ?? true}
          onChange={(v) => set({ showClasses: v })}
        />
        <Toggle
          label="Work"
          checked={merged.showWork ?? true}
          onChange={(v) => set({ showWork: v })}
        />
        <Toggle
          label="Planning blocks"
          checked={merged.showPlanningBlocks ?? true}
          onChange={(v) => set({ showPlanningBlocks: v })}
        />
        <Toggle
          label="Deadlines"
          checked={merged.showDeadlines ?? true}
          onChange={(v) => set({ showDeadlines: v })}
        />
        <Toggle
          label="Blocking only"
          checked={merged.blockingOnly ?? false}
          onChange={(v) => set({ blockingOnly: v })}
        />
        <Toggle
          label="Completed planning blocks"
          checked={merged.showCompletedPlanningBlocks ?? true}
          onChange={(v) => set({ showCompletedPlanningBlocks: v })}
        />
        <Toggle
          label="Cancelled items"
          checked={merged.showCancelled ?? false}
          onChange={(v) => set({ showCancelled: v })}
        />
      </div>
    </details>
  );
}
