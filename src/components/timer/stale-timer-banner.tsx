import { getActiveTimer } from "@/lib/data/time-entries";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { isStaleTimer } from "@/lib/time/stale-timer";
import { StaleTimerPrompt } from "@/components/timer/stale-timer-prompt";

export async function StaleTimerBanner() {
  const [active, prefs] = await Promise.all([
    getActiveTimer(),
    getPlanningPreferences(),
  ]);

  if (!active) return null;

  const threshold = prefs.stale_timer_threshold_hours ?? 4;
  if (!isStaleTimer(active, threshold)) return null;

  return <StaleTimerPrompt active={active} thresholdHours={threshold} />;
}
