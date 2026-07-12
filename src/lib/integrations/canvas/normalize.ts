import { createHash } from "crypto";
import { addDays, format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";
import {
  isAllDayProperty,
  parseIcsDateProperty,
  type ParsedIcsEvent,
} from "@/lib/integrations/canvas/ics-parser";
import type {
  NormalizedCanvasEvent,
  ParsedFeedResult,
} from "@/lib/integrations/canvas/schemas";

const DEADLINE_PATTERN =
  /\b(assignment|due|deadline|submit|submission|homework|quiz|exam|project)\b/i;
const CLASS_PATTERN =
  /\b(class|lecture|lab|section|recitation|seminar|course meeting)\b/i;

function resolveEventTimes(
  event: ParsedIcsEvent,
): { startAt: Date; endAt: Date; allDay: boolean } | null {
  if (!event.dtstart) {
    return null;
  }

  const startParsed = parseIcsDateProperty(event.dtstart);
  if (!startParsed) {
    return null;
  }

  const allDay = startParsed.allDay;
  let startAt = startParsed.date;
  let endAt = startAt;

  if (event.dtend) {
    const endParsed = parseIcsDateProperty(event.dtend);
    if (endParsed) {
      endAt = endParsed.date;
    }
  }

  if (allDay) {
    const startKey = format(startAt, "yyyy-MM-dd");
    startAt = fromZonedTime(`${startKey}T00:00:00`, APP_TIMEZONE);

    const endKey = event.dtend
      ? format(endAt, "yyyy-MM-dd")
      : format(addDays(startAt, 1), "yyyy-MM-dd");
    endAt = fromZonedTime(`${endKey}T00:00:00`, APP_TIMEZONE);

    if (endAt <= startAt) {
      endAt = fromZonedTime(
        `${format(addDays(startAt, 1), "yyyy-MM-dd")}T00:00:00`,
        APP_TIMEZONE,
      );
    }

    return { startAt, endAt, allDay: true };
  }

  if (endAt <= startAt) {
    endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  }

  return { startAt, endAt, allDay: false };
}

function parseLastModified(value: string | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }

  const property = {
    name: "LAST-MODIFIED",
    params: {},
    value: value.trim(),
  };

  if (isAllDayProperty(property)) {
    return null;
  }

  const parsed = parseIcsDateProperty(property);
  return parsed?.date ?? null;
}

function mapStatus(event: ParsedIcsEvent): "confirmed" | "cancelled" | "tentative" {
  const status = String(event.status ?? "").toUpperCase();
  if (status === "CANCELLED") {
    return "cancelled";
  }
  if (status === "TENTATIVE") {
    return "tentative";
  }
  return "confirmed";
}

function inferEventType(
  title: string,
  description: string | null,
): NormalizedCanvasEvent["eventType"] {
  const haystack = `${title} ${description ?? ""}`;
  if (DEADLINE_PATTERN.test(haystack)) {
    return "deadline";
  }
  if (CLASS_PATTERN.test(haystack)) {
    return "class";
  }
  return "other";
}

function buildContentHash(event: Omit<NormalizedCanvasEvent, "contentHash">): string {
  const canonical = JSON.stringify({
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    status: event.status,
    eventType: event.eventType,
    externalUpdatedAt: event.externalUpdatedAt,
  });

  return createHash("sha256").update(canonical).digest("hex");
}

export function normalizeCanvasEvent(event: ParsedIcsEvent): NormalizedCanvasEvent | null {
  const externalEventId = event.uid?.trim();
  const title = event.summary?.trim();

  if (!externalEventId || !title) {
    return null;
  }

  const times = resolveEventTimes(event);
  if (!times) {
    return null;
  }

  const description = event.description?.trim() || null;
  const location = event.location?.trim() || null;
  const lastModified = parseLastModified(event.lastModified);

  const normalizedWithoutHash = {
    externalEventId,
    title,
    description,
    location,
    startAt: times.startAt.toISOString(),
    endAt: times.endAt.toISOString(),
    allDay: times.allDay,
    status: mapStatus(event),
    eventType: inferEventType(title, description),
    externalUpdatedAt: lastModified ? lastModified.toISOString() : null,
  };

  return {
    ...normalizedWithoutHash,
    contentHash: buildContentHash(normalizedWithoutHash),
  };
}

export function normalizeCanvasEvents(
  events: ParsedIcsEvent[],
  initialWarnings = 0,
): ParsedFeedResult {
  const normalized: NormalizedCanvasEvent[] = [];
  let warnings = initialWarnings;

  for (const event of events) {
    try {
      const item = normalizeCanvasEvent(event);
      if (!item) {
        warnings += 1;
        continue;
      }
      normalized.push(item);
    } catch {
      warnings += 1;
    }
  }

  return { events: normalized, warnings };
}

export function computeFeedHash(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function computeSyncWindow(events: NormalizedCanvasEvent[]): {
  start: string | null;
  end: string | null;
} {
  if (events.length === 0) {
    return { start: null, end: null };
  }

  let minStart = events[0]!.startAt;
  let maxEnd = events[0]!.endAt;

  for (const event of events) {
    if (event.startAt < minStart) {
      minStart = event.startAt;
    }
    if (event.endAt > maxEnd) {
      maxEnd = event.endAt;
    }
  }

  return { start: minStart, end: maxEnd };
}

export function shouldReconcileRemovals(input: {
  parsedEventCount: number;
  previousEventCount: number | null;
  warnings: number;
}): boolean {
  if (input.parsedEventCount === 0) {
    return false;
  }

  const previousCount = input.previousEventCount ?? 0;
  if (previousCount > 10 && input.parsedEventCount < 3) {
    return false;
  }

  const warningRatio = input.warnings / Math.max(input.parsedEventCount, 1);
  if (warningRatio > 0.5) {
    return false;
  }

  return true;
}
