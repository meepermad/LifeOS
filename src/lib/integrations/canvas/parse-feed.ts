import { normalizeCanvasEvents } from "@/lib/integrations/canvas/normalize";
import {
  parseIcsEvents,
  type ParsedIcsEvent,
} from "@/lib/integrations/canvas/ics-parser";
import type { ParsedFeedResult } from "@/lib/integrations/canvas/schemas";

function getLastModifiedTime(event: ParsedIcsEvent): number {
  if (!event.lastModified) {
    return 0;
  }

  const value = event.lastModified.trim();
  const utc = value.endsWith("Z");
  const cleaned = utc ? value.slice(0, -1) : value;
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  const [, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${utc ? "Z" : ""}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function dedupeEventsByUid(
  events: ParsedIcsEvent[],
): { events: ParsedIcsEvent[]; warnings: number } {
  const byUid = new Map<string, ParsedIcsEvent>();
  let warnings = 0;

  for (const event of events) {
    const uid = event.uid?.trim();
    if (!uid) {
      warnings += 1;
      continue;
    }

    const existing = byUid.get(uid);
    if (!existing) {
      byUid.set(uid, event);
      continue;
    }

    warnings += 1;
    if (getLastModifiedTime(event) >= getLastModifiedTime(existing)) {
      byUid.set(uid, event);
    }
  }

  return { events: [...byUid.values()], warnings };
}

function countDuplicateUids(icsBody: string): number {
  const matches = [...icsBody.matchAll(/^UID:(.+)$/gm)];
  const counts = new Map<string, number>();
  for (const match of matches) {
    const uid = match[1]?.trim();
    if (!uid) continue;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }

  let duplicates = 0;
  for (const count of counts.values()) {
    if (count > 1) {
      duplicates += count - 1;
    }
  }
  return duplicates;
}

export function parseCanvasFeed(icsBody: string): ParsedFeedResult {
  const duplicateUidWarnings = countDuplicateUids(icsBody);
  let rawEvents: ParsedIcsEvent[] = [];

  try {
    rawEvents = parseIcsEvents(icsBody);
  } catch {
    return { events: [], warnings: 1 };
  }

  let warnings = 0;
  const validEvents = rawEvents.filter((event) => {
    if (!event.uid?.trim() || !event.summary?.trim() || !event.dtstart) {
      warnings += 1;
      return false;
    }
    return true;
  });

  const deduped = dedupeEventsByUid(validEvents);
  warnings += deduped.warnings + duplicateUidWarnings;

  return normalizeCanvasEvents(deduped.events, warnings);
}
