import type { TimeInterval } from "@/lib/planning/types";

export function intervalDurationMinutes(interval: TimeInterval): number {
  return Math.floor(Math.max(0, interval.endMs - interval.startMs) / 60_000);
}

export function totalDurationMinutes(intervals: TimeInterval[]): number {
  return intervals.reduce((sum, interval) => sum + intervalDurationMinutes(interval), 0);
}

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: TimeInterval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

export function clipInterval(
  interval: TimeInterval,
  bounds: TimeInterval,
): TimeInterval | null {
  const startMs = Math.max(interval.startMs, bounds.startMs);
  const endMs = Math.min(interval.endMs, bounds.endMs);

  if (endMs <= startMs) return null;
  return { startMs, endMs };
}

export function clipIntervals(
  intervals: TimeInterval[],
  bounds: TimeInterval,
): TimeInterval[] {
  return intervals
    .map((interval) => clipInterval(interval, bounds))
    .filter((interval): interval is TimeInterval => interval !== null);
}

export function subtractIntervals(
  base: TimeInterval[],
  toSubtract: TimeInterval[],
): TimeInterval[] {
  if (base.length === 0) return [];
  if (toSubtract.length === 0) return mergeIntervals(base);

  const mergedSubtract = mergeIntervals(toSubtract);
  let result: TimeInterval[] = mergeIntervals(base);

  for (const block of mergedSubtract) {
    const next: TimeInterval[] = [];

    for (const interval of result) {
      if (block.endMs <= interval.startMs || block.startMs >= interval.endMs) {
        next.push(interval);
        continue;
      }

      if (block.startMs > interval.startMs) {
        next.push({ startMs: interval.startMs, endMs: block.startMs });
      }

      if (block.endMs < interval.endMs) {
        next.push({ startMs: block.endMs, endMs: interval.endMs });
      }
    }

    result = next;
  }

  return mergeIntervals(result);
}

export function intersectIntervals(
  a: TimeInterval[],
  b: TimeInterval[],
): TimeInterval[] {
  const mergedA = mergeIntervals(a);
  const mergedB = mergeIntervals(b);
  const result: TimeInterval[] = [];

  for (const left of mergedA) {
    for (const right of mergedB) {
      const clipped = clipInterval(left, right);
      if (clipped) result.push(clipped);
    }
  }

  return mergeIntervals(result);
}

export function expandInterval(
  interval: TimeInterval,
  bufferMinutes: number,
): TimeInterval {
  const bufferMs = bufferMinutes * 60_000;
  return {
    startMs: interval.startMs - bufferMs,
    endMs: interval.endMs + bufferMs,
  };
}

export function toInterval(start: Date | string, end: Date | string): TimeInterval {
  return {
    startMs: new Date(start).getTime(),
    endMs: new Date(end).getTime(),
  };
}

export function dayBoundsInterval(start: Date, end: Date): TimeInterval {
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}
