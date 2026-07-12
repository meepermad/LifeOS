import { fromZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";

export type IcsProperty = {
  name: string;
  params: Record<string, string>;
  value: string;
};

export type ParsedIcsEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  dtstart?: IcsProperty;
  dtend?: IcsProperty;
  status?: string;
  lastModified?: string;
};

function unfoldIcsLines(body: string): string[] {
  const raw = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];

  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\N/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseProperty(line: string): IcsProperty | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }

  const left = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const semiIndex = left.indexOf(";");
  const name = (semiIndex === -1 ? left : left.slice(0, semiIndex)).toUpperCase();
  const params: Record<string, string> = {};

  if (semiIndex !== -1) {
    for (const part of left.slice(semiIndex + 1).split(";")) {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) {
        continue;
      }
      params[part.slice(0, eqIndex).toUpperCase()] = part.slice(eqIndex + 1);
    }
  }

  return { name, params, value };
}

export function parseIcsEvents(body: string): ParsedIcsEvent[] {
  const lines = unfoldIcsLines(body);
  const events: ParsedIcsEvent[] = [];
  let current: ParsedIcsEvent | null = null;
  let inEvent = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current) {
        events.push(current);
      }
      inEvent = false;
      current = null;
      continue;
    }

    if (!inEvent || !current) {
      continue;
    }

    const property = parseProperty(line);
    if (!property) {
      continue;
    }

    switch (property.name) {
      case "UID":
        current.uid = property.value.trim();
        break;
      case "SUMMARY":
        current.summary = unescapeIcsText(property.value.trim());
        break;
      case "DESCRIPTION":
        current.description = unescapeIcsText(property.value.trim());
        break;
      case "LOCATION":
        current.location = unescapeIcsText(property.value.trim());
        break;
      case "DTSTART":
        current.dtstart = property;
        break;
      case "DTEND":
        current.dtend = property;
        break;
      case "STATUS":
        current.status = property.value.trim();
        break;
      case "LAST-MODIFIED":
        current.lastModified = property.value.trim();
        break;
      default:
        break;
    }
  }

  return events;
}

export function isAllDayProperty(property: IcsProperty): boolean {
  if (property.params.VALUE?.toUpperCase() === "DATE") {
    return true;
  }

  return /^\d{8}$/.test(property.value.trim());
}

export function parseIcsDateProperty(
  property: IcsProperty,
  options?: { floatingTimeZone?: string },
): { date: Date; allDay: boolean; floating: boolean } | null {
  const value = property.value.trim();
  const floatingTimeZone = options?.floatingTimeZone ?? APP_TIMEZONE;

  if (isAllDayProperty(property)) {
    const dateKey = value.length >= 8 ? value.slice(0, 8) : value;
    const match = dateKey.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    const zone = property.params.TZID ?? floatingTimeZone;
    const date = fromZonedDateTime(`${year}-${month}-${day}T00:00:00`, zone);
    return { date, allDay: true, floating: !property.params.TZID };
  }

  const utc = value.endsWith("Z");
  const cleaned = utc ? value.slice(0, -1) : value;
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const localIso = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  if (utc) {
    const date = new Date(`${localIso}Z`);
    return Number.isNaN(date.getTime())
      ? null
      : { date, allDay: false, floating: false };
  }

  if (property.params.TZID) {
    const date = fromZonedDateTime(localIso, property.params.TZID);
    return { date, allDay: false, floating: false };
  }

  const date = fromZonedDateTime(localIso, floatingTimeZone);
  return { date, allDay: false, floating: true };
}

function fromZonedDateTime(localIso: string, timeZone: string): Date {
  return fromZonedTime(localIso, timeZone);
}
