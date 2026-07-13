export type EntryQualityFlag =
  | "future_start"
  | "zero_duration"
  | "excessive_duration"
  | "cross_midnight_timer"
  | "duplicate_window"
  | "overlap"
  | "excessive_pause_ratio";

export type EntryQualityResult = {
  needsReview: boolean;
  reasons: EntryQualityFlag[];
  reviewReason: string | null;
};

const TWELVE_HOURS_SEC = 12 * 60 * 60;
const MAX_PAUSE_RATIO = 0.75;

export type EntryForQuality = {
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  entry_source: string;
};

export type PauseSegmentForQuality = {
  paused_at: string;
  resumed_at: string | null;
};

export function checkEntryQuality(
  entry: EntryForQuality,
  options?: {
    pauseSegments?: PauseSegmentForQuality[];
    otherEntries?: EntryForQuality[];
    now?: Date;
  },
): EntryQualityResult {
  const reasons: EntryQualityFlag[] = [];
  const now = options?.now ?? new Date();
  const start = new Date(entry.started_at);
  const end = entry.ended_at ? new Date(entry.ended_at) : now;

  if (start.getTime() > now.getTime()) {
    reasons.push("future_start");
  }

  const durationSec =
    entry.duration_seconds ??
    Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

  if (durationSec <= 0 && entry.ended_at) {
    reasons.push("zero_duration");
  }

  if (durationSec > TWELVE_HOURS_SEC) {
    reasons.push("excessive_duration");
  }

  if (
    entry.entry_source === "timer" &&
    start.toDateString() !== end.toDateString() &&
    entry.ended_at
  ) {
    reasons.push("cross_midnight_timer");
  }

  const pauseSegments = options?.pauseSegments ?? [];
  if (pauseSegments.length > 0 && durationSec > 0) {
    let pausedMs = 0;
    for (const seg of pauseSegments) {
      const pStart = new Date(seg.paused_at).getTime();
      const pEnd = seg.resumed_at
        ? new Date(seg.resumed_at).getTime()
        : end.getTime();
      pausedMs += Math.max(0, pEnd - pStart);
    }
    const pauseRatio = pausedMs / 1000 / durationSec;
    if (pauseRatio > MAX_PAUSE_RATIO) {
      reasons.push("excessive_pause_ratio");
    }
  }

  for (const other of options?.otherEntries ?? []) {
    if (!other.ended_at || !entry.ended_at) continue;
    const oStart = new Date(other.started_at).getTime();
    const oEnd = new Date(other.ended_at).getTime();
    const eStart = start.getTime();
    const eEnd = end.getTime();

    if (eStart === oStart && eEnd === oEnd) {
      reasons.push("duplicate_window");
      break;
    }
    if (eStart < oEnd && eEnd > oStart) {
      reasons.push("overlap");
      break;
    }
  }

  const reviewReason =
    reasons.length > 0 ? reasons.map(formatFlag).join("; ") : null;

  return {
    needsReview: reasons.length > 0,
    reasons,
    reviewReason,
  };
}

function formatFlag(flag: EntryQualityFlag): string {
  switch (flag) {
    case "future_start":
      return "Start time is in the future";
    case "zero_duration":
      return "Zero or negative duration";
    case "excessive_duration":
      return "Session exceeds 12 hours";
    case "cross_midnight_timer":
      return "Timer spans midnight";
    case "duplicate_window":
      return "Duplicate time window";
    case "overlap":
      return "Overlaps another entry";
    case "excessive_pause_ratio":
      return "Excessive pause time";
    default:
      return flag;
  }
}

export function isImplausibleDuration(seconds: number): boolean {
  return seconds > 0 && (seconds < 60 || seconds > TWELVE_HOURS_SEC);
}
