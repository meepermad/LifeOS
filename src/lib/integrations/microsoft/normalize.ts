import { createHash } from "crypto";
import { addDays, subDays } from "date-fns";
import type { GraphEvent } from "@/lib/integrations/microsoft/schemas";
import type { NormalizedMicrosoftEvent } from "@/lib/integrations/microsoft/schemas";

const CLASS_PATTERN =
  /\b(class|lecture|lab|section|recitation|seminar|course|syllabus)\b/i;
const MEETING_PATTERN =
  /\b(meeting|teams|zoom|invite|interview|standup|sync|call)\b/i;

export function computeSyncWindowUtc(now = new Date()): {
  windowStart: string;
  windowEnd: string;
} {
  const windowStart = subDays(now, 30).toISOString();
  const windowEnd = addDays(now, 180).toISOString();
  return { windowStart, windowEnd };
}

export function shouldResetSyncWindow(
  syncWindowEnd: string | null,
  now = new Date(),
): boolean {
  if (!syncWindowEnd) {
    return true;
  }

  const resetThreshold = addDays(now, 7).toISOString();
  return syncWindowEnd < resetThreshold;
}

function parseGraphDateTime(
  value: { dateTime: string; timeZone: string },
  allDay: boolean,
): string {
  if (allDay) {
    const datePart = value.dateTime.slice(0, 10);
    return new Date(`${datePart}T00:00:00.000Z`).toISOString();
  }

  const hasOffset = /[zZ]$|[+-]\d{2}:\d{2}$/.test(value.dateTime);
  if (hasOffset) {
    return new Date(value.dateTime).toISOString();
  }

  return new Date(`${value.dateTime}Z`).toISOString();
}

function resolveTitle(event: GraphEvent, redactPrivate: boolean): string {
  if (event["@removed"]) {
    return "Removed event";
  }

  const sensitivity = (event.sensitivity ?? "").toLowerCase();
  if (redactPrivate && (sensitivity === "private" || sensitivity === "confidential")) {
    return "Private event";
  }

  const subject = event.subject?.trim();
  return subject && subject.length > 0 ? subject : "Untitled event";
}

function mapStatus(
  event: GraphEvent,
): "confirmed" | "cancelled" | "tentative" {
  if (event["@removed"] || event.isCancelled) {
    return "cancelled";
  }

  const showAs = (event.showAs ?? "").toLowerCase();
  if (showAs === "tentative") {
    return "tentative";
  }

  return "confirmed";
}

function mapBlocksTime(event: GraphEvent, status: string): boolean {
  if (status === "cancelled") {
    return false;
  }

  const showAs = (event.showAs ?? "").toLowerCase();
  if (showAs === "free") {
    return false;
  }

  return true;
}

function inferEventType(
  title: string,
  event: GraphEvent,
): "class" | "meeting" | "appointment" | "other" {
  if (CLASS_PATTERN.test(title)) {
    return "class";
  }

  if (
    MEETING_PATTERN.test(title) ||
    Boolean(event.onlineMeeting?.joinUrl || event.onlineMeetingUrl) ||
    event.type?.toLowerCase() === "occurrence" ||
    event.type?.toLowerCase() === "exception"
  ) {
    return "meeting";
  }

  if (event.type?.toLowerCase() === "singleinstance") {
    return "appointment";
  }

  return "other";
}

export function buildMicrosoftContentHash(event: NormalizedMicrosoftEvent): string {
  const canonical = JSON.stringify({
    externalEventId: event.externalEventId,
    title: event.title,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    status: event.status,
    eventType: event.eventType,
    blocksTime: event.blocksTime,
    externalChangeKey: event.externalChangeKey,
    showAs: event.showAs,
    sensitivity: event.sensitivity,
    organizerName: event.organizerName,
    onlineMeetingUrl: event.onlineMeetingUrl,
  });

  return createHash("sha256").update(canonical).digest("hex");
}

export function normalizeMicrosoftEvent(
  event: GraphEvent,
  options: { redactPrivateTitles?: boolean } = {},
): NormalizedMicrosoftEvent | null {
  if (!event.id) {
    return null;
  }

  const redactPrivate = options.redactPrivateTitles ?? true;
  const isRemoved = Boolean(event["@removed"]);
  const allDay = Boolean(event.isAllDay);
  const status = mapStatus(event);

  let startAt: string;
  let endAt: string;

  if (!isRemoved) {
    startAt = parseGraphDateTime(event.start, allDay);
    endAt = parseGraphDateTime(event.end, allDay);

    if (allDay && endAt <= startAt) {
      endAt = addDays(new Date(startAt), 1).toISOString();
    }

    if (!allDay && endAt <= startAt) {
      endAt = new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();
    }
  } else {
    const now = new Date().toISOString();
    startAt = now;
    endAt = now;
  }

  const title = resolveTitle(event, redactPrivate);
  const blocksTime = isRemoved ? false : mapBlocksTime(event, status);
  const eventType = isRemoved ? "other" : inferEventType(title, event);

  const normalized: NormalizedMicrosoftEvent = {
    externalEventId: event.id,
    iCalUId: event.iCalUId ?? null,
    title,
    location: event.location?.displayName?.trim() || null,
    startAt,
    endAt,
    allDay,
    status,
    eventType,
    blocksTime,
    externalUpdatedAt: event.lastModifiedDateTime ?? null,
    externalChangeKey: event.changeKey ?? null,
    showAs: event.showAs ?? null,
    sensitivity: event.sensitivity ?? null,
    organizerName: event.organizer?.emailAddress?.name?.trim() || null,
    onlineMeetingUrl:
      event.onlineMeeting?.joinUrl?.trim() ||
      event.onlineMeetingUrl?.trim() ||
      null,
    contentHash: "",
    isRemoved,
  };

  normalized.contentHash = buildMicrosoftContentHash(normalized);
  return normalized;
}

export function normalizeMicrosoftEvents(
  events: GraphEvent[],
  options: { redactPrivateTitles?: boolean } = {},
): { events: NormalizedMicrosoftEvent[]; warnings: number } {
  let warnings = 0;
  const normalized: NormalizedMicrosoftEvent[] = [];

  for (const event of events) {
    const mapped = normalizeMicrosoftEvent(event, options);
    if (!mapped) {
      warnings += 1;
      continue;
    }
    normalized.push(mapped);
  }

  return { events: normalized, warnings };
}
