import type { ActiveTimerState } from "@/lib/data/time-entries";

export function isStaleTimer(
  active: ActiveTimerState | null,
  thresholdHours: number,
  now = new Date(),
): boolean {
  if (!active) return false;
  const startMs = new Date(active.entry.started_at).getTime();
  const ageHours = (now.getTime() - startMs) / (1000 * 60 * 60);
  return ageHours >= thresholdHours;
}

export function formatStalePrompt(
  active: ActiveTimerState,
  thresholdHours: number,
): string {
  const title = active.entry.task_title_snapshot ?? "this task";
  return `Your timer for "${title}" has been running for more than ${thresholdHours} hours. Still working, or stop it now?`;
}

export function staleTimerAgeHours(
  active: ActiveTimerState,
  now = new Date(),
): number {
  const startMs = new Date(active.entry.started_at).getTime();
  return Math.round(((now.getTime() - startMs) / (1000 * 60 * 60)) * 10) / 10;
}
