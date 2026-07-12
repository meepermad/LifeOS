export const SYNC_STATE_CALENDAR_CONFLICT_TARGET = "calendar_id" as const;

export type SafePostgrestError = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
};

function sanitizeDatabaseMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/Bearer\s+\S+/gi, "[token]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .trim()
    .slice(0, 160);
}

export function buildSyncStatePersistenceError(
  provider: "canvas" | "microsoft",
  error: SafePostgrestError | null,
): string {
  if (!error) {
    return "Failed to update sync state: unknown database error";
  }

  const code = error.code?.trim() || "unknown";
  const message = sanitizeDatabaseMessage(error.message?.trim() || "unknown error");

  if (code === "42P10") {
    return "Failed to update sync state: database constraint mismatch (42P10)";
  }

  return `Failed to update sync state: ${message} (${code})`;
}

export function logSyncStateDatabaseError(
  provider: "canvas" | "microsoft",
  error: SafePostgrestError | null,
): void {
  if (!error) {
    console.error(`Sync state persistence failed provider=${provider} operation=upsert`);
    return;
  }

  const message = error.message ? sanitizeDatabaseMessage(error.message) : "unknown error";
  const hint = error.hint ? sanitizeDatabaseMessage(error.hint) : null;

  console.error(
    `Sync state persistence failed provider=${provider} operation=upsert code=${error.code ?? "unknown"} message=${message}${hint ? ` hint=${hint}` : ""}`,
  );
}
