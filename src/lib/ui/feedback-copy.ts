/** Consistent success / error vocabulary for LifeOS UI feedback. */

export const FeedbackCopy = {
  saved: "Saved",
  updated: "Updated",
  scheduled: "Scheduled",
  proposed: "Proposed",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
  disconnected: "Disconnected",
  requiresReview: "Requires review",
  couldNotSave: "Could not save",
  couldNotRefresh: "Could not refresh",
} as const;

export type FeedbackSuccessKey = keyof typeof FeedbackCopy;

export const PendingLabels = {
  saving: "Saving…",
  creating: "Creating…",
  creatingPreview: "Creating preview…",
  synchronizingCanvas: "Synchronizing Canvas…",
  startingTimer: "Starting timer…",
  updatingShift: "Updating shift…",
  completingReview: "Completing review…",
  generatingPlan: "Generating plan…",
  deleting: "Deleting…",
  loading: "Loading…",
} as const;

export function safeErrorMessage(
  error: unknown,
  fallback: string = FeedbackCopy.couldNotSave,
): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (!message) return fallback;
    if (/relation|permission denied|violates|PGRST|JWT|stack/i.test(message)) {
      return fallback;
    }
    return message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

export function classifyRouteError(
  error: unknown,
): "connection" | "authorization" | "unknown" {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (/unauthorized|forbidden|not allowed|auth/i.test(message)) {
    return "authorization";
  }
  if (/network|fetch failed|offline|connection|timeout|ECONNREFUSED/i.test(message)) {
    return "connection";
  }
  return "unknown";
}
