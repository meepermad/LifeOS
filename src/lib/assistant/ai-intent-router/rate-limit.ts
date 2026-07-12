type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const userBuckets = new Map<string, RateLimitEntry>();
const USER_LIMIT = 20;
const USER_WINDOW_MS = 60_000;

let circuitFailureCount = 0;
let circuitOpenedAt: number | null = null;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_WINDOW_MS = 5 * 60_000;
const CIRCUIT_OPEN_MS = 15 * 60_000;

let globalDailyCount = 0;
let globalDailyDateKey = "";

export function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userBuckets.get(userId);
  if (!entry || now >= entry.resetAt) {
    userBuckets.set(userId, { count: 1, resetAt: now + USER_WINDOW_MS });
    return true;
  }
  if (entry.count >= USER_LIMIT) return false;
  entry.count += 1;
  return true;
}

export function isCircuitOpen(): boolean {
  if (circuitOpenedAt === null) return false;
  if (Date.now() - circuitOpenedAt >= CIRCUIT_OPEN_MS) {
    circuitOpenedAt = null;
    circuitFailureCount = 0;
    return false;
  }
  return true;
}

export function recordProviderFailure(): void {
  const now = Date.now();
  if (
    circuitOpenedAt !== null &&
    now - circuitOpenedAt < CIRCUIT_OPEN_MS
  ) {
    return;
  }

  if (
    circuitFailureCount > 0 &&
    now - (circuitOpenedAt ?? now) > CIRCUIT_WINDOW_MS
  ) {
    circuitFailureCount = 0;
  }

  circuitFailureCount += 1;
  if (circuitFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenedAt = now;
  }
}

export function recordProviderSuccess(): void {
  circuitFailureCount = 0;
  circuitOpenedAt = null;
}

export function checkGlobalInMemoryCap(dailyCap: number): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (globalDailyDateKey !== today) {
    globalDailyDateKey = today;
    globalDailyCount = 0;
  }
  if (globalDailyCount >= dailyCap) return false;
  globalDailyCount += 1;
  return true;
}

export function resetRateLimitStateForTests(): void {
  userBuckets.clear();
  circuitFailureCount = 0;
  circuitOpenedAt = null;
  globalDailyCount = 0;
  globalDailyDateKey = "";
}
