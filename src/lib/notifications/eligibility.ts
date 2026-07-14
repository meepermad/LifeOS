/**
 * Timed notification due-window eligibility.
 *
 * Cron runs every 15 minutes. A notification is due when its correctly resolved
 * scheduled instant is in the past (or exactly now) but still within the grace
 * window that tolerates ordinary cron delay.
 *
 * Example with a 20-minute grace window:
 *   Configured local time: 1:00 PM
 *   Cron invocation: 1:15 PM
 *   Result: due
 *
 * Stages (do not collapse these internally):
 *   not_due_yet | due | stale | already_sent | disabled | quiet_hours |
 *   no_eligible_content | no_subscription
 */

/** Grace window for ordinary cron delay (documented; slightly above the 15m cadence). */
export const NOTIFICATION_GRACE_WINDOW_MS = 20 * 60 * 1000;

export type TimedEligibilityStage = "not_due_yet" | "due" | "stale";

export type NotificationEligibilityStage =
  | TimedEligibilityStage
  | "already_sent"
  | "disabled"
  | "quiet_hours"
  | "no_eligible_content"
  | "no_subscription"
  | "attempted"
  | "sent"
  | "failed";

/**
 * Evaluate whether a resolved scheduled instant is within the eligible send window.
 *
 * due when: scheduledInstant <= now AND scheduledInstant > previousEligibleBoundary
 * where previousEligibleBoundary = now - graceWindowMs
 */
export function evaluateTimedEligibility(
  scheduledInstant: Date,
  now: Date,
  graceWindowMs: number = NOTIFICATION_GRACE_WINDOW_MS,
): TimedEligibilityStage {
  const scheduledMs = scheduledInstant.getTime();
  const nowMs = now.getTime();

  if (Number.isNaN(scheduledMs) || Number.isNaN(nowMs)) {
    return "stale";
  }

  if (scheduledMs > nowMs) {
    return "not_due_yet";
  }

  const previousEligibleBoundary = nowMs - graceWindowMs;
  if (scheduledMs <= previousEligibleBoundary) {
    return "stale";
  }

  return "due";
}

export function scheduledVersusProcessingOffsetMinutes(
  scheduledInstant: Date,
  processedAt: Date,
): number {
  return Math.round(
    (processedAt.getTime() - scheduledInstant.getTime()) / (60 * 1000),
  );
}

export function logNotificationEligibility(input: {
  notificationType: string;
  eligibilityStage: NotificationEligibilityStage | string;
  safeSkipReason?: string | null;
  resolvedTimezone: string;
  scheduledVersusProcessingOffsetMinutes?: number;
}): void {
  console.info(
    "[notifications]",
    JSON.stringify({
      notificationType: input.notificationType,
      eligibilityStage: input.eligibilityStage,
      safeSkipReason: input.safeSkipReason ?? null,
      resolvedTimezone: input.resolvedTimezone,
      scheduledVersusProcessingOffsetMinutes:
        input.scheduledVersusProcessingOffsetMinutes ?? null,
    }),
  );
}
