export type CalendarExportEvent = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: string;
  workProfileLabel?: string | null;
};

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatDateInTimeZone(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}${part("month")}${part("day")}`;
}

function formatDateTimeInTimeZone(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}${part("month")}${part("day")}T${part("hour")}${part("minute")}${part("second")}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildIcsCalendar(
  events: readonly CalendarExportEvent[],
  timeZone: string,
  now = new Date(),
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LifeOS//Export Center//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-TIMEZONE:${escapeIcsText(timeZone)}`,
  ];

  for (const event of events) {
    if (event.status === "cancelled") continue;
    const summary = event.workProfileLabel
      ? `${event.title} (${event.workProfileLabel})`
      : event.title;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(event.id)}@lifeos`);
    lines.push(`DTSTAMP:${formatUtc(now)}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (event.allDay) {
      const start = formatDateInTimeZone(event.startAt, timeZone);
      const exportedEnd = formatDateInTimeZone(event.endAt, timeZone);
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${exportedEnd > start ? exportedEnd : addDays(start, 1)}`);
    } else {
      lines.push(`DTSTART;TZID=${escapeIcsText(timeZone)}:${formatDateTimeInTimeZone(event.startAt, timeZone)}`);
      lines.push(`DTEND;TZID=${escapeIcsText(timeZone)}:${formatDateTimeInTimeZone(event.endAt, timeZone)}`);
    }
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
