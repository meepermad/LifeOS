type Bucket = { count: number; resetAt: number };

const deviceBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();
const failedAuthBuckets = new Map<string, Bucket>();

function checkBucket(
  map: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = map.get(key);

  if (!bucket || bucket.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function checkShortcutDeviceRateLimit(deviceId: string): boolean {
  return checkBucket(deviceBuckets, deviceId, 30, 60_000);
}

export function checkShortcutIpRateLimit(ip: string): boolean {
  return checkBucket(ipBuckets, ip, 60, 60_000);
}

export function checkFailedAuthRateLimit(ip: string): boolean {
  return checkBucket(failedAuthBuckets, ip, 10, 15 * 60_000);
}

export function resetRateLimitState(): void {
  deviceBuckets.clear();
  ipBuckets.clear();
  failedAuthBuckets.clear();
}
