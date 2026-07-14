const EXPORT_WINDOW_MS = 10 * 60 * 1000;
const MAX_EXPORTS_PER_WINDOW = 10;
const attemptsByUser = new Map<string, number[]>();

export function allowExport(userId: string, now = Date.now()): boolean {
  const windowStart = now - EXPORT_WINDOW_MS;
  const attempts = (attemptsByUser.get(userId) ?? []).filter(
    (attempt) => attempt > windowStart,
  );

  if (attempts.length >= MAX_EXPORTS_PER_WINDOW) {
    attemptsByUser.set(userId, attempts);
    return false;
  }

  attempts.push(now);
  attemptsByUser.set(userId, attempts);
  return true;
}
