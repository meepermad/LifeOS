import { describe, expect, it } from "vitest";
import { buildBackup } from "@/lib/export/backup";
import { buildCsv, escapeCsvValue } from "@/lib/export/csv";
import { exportHeaders } from "@/lib/export/headers";
import { buildIcsCalendar } from "@/lib/export/ics";

describe("export helpers", () => {
  it("escapes CSV commas, quotes, and newlines", () => {
    expect(escapeCsvValue('one,"two"\nthree')).toBe('"one,""two""\nthree"');
    expect(buildCsv(["title"], [['Say "hello", now']])).toBe(
      'title\r\n"Say ""hello"", now"',
    );
  });

  it("builds ICS events and excludes cancelled events", () => {
    const ics = buildIcsCalendar(
      [
        {
          id: "active",
          title: "Morning shift",
          startAt: "2026-07-14T14:00:00.000Z",
          endAt: "2026-07-14T18:00:00.000Z",
          allDay: false,
          status: "confirmed",
          workProfileLabel: "Library",
        },
        {
          id: "cancelled",
          title: "Cancelled event",
          startAt: "2026-07-15T00:00:00.000Z",
          endAt: "2026-07-16T00:00:00.000Z",
          allDay: true,
          status: "cancelled",
        },
      ],
      "America/Chicago",
      new Date("2026-07-01T00:00:00.000Z"),
    );

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Morning shift (Library)");
    expect(ics).toContain("DTSTART;TZID=America/Chicago:");
    expect(ics).not.toContain("Cancelled event");
  });

  it("uses date values for all-day ICS events", () => {
    const ics = buildIcsCalendar(
      [
        {
          id: "all-day",
          title: "Exam day",
          startAt: "2026-07-14T05:00:00.000Z",
          endAt: "2026-07-15T05:00:00.000Z",
          allDay: true,
          status: "confirmed",
        },
      ],
      "America/Chicago",
    );

    expect(ics).toContain("DTSTART;VALUE=DATE:20260714");
    expect(ics).toContain("DTEND;VALUE=DATE:20260715");
  });

  it("wraps backup data with its schema version", () => {
    expect(buildBackup({ tasks: [{ id: "task-1" }] }, "2026-07-14T00:00:00.000Z")).toEqual({
      schemaVersion: 1,
      exportedAt: "2026-07-14T00:00:00.000Z",
      data: { tasks: [{ id: "task-1" }] },
    });
  });

  it("uses no-store download headers", () => {
    const headers = exportHeaders("lifeos tasks.csv", "text/csv");
    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("Content-Disposition")).toContain('filename="lifeos-tasks.csv"');
  });

  it("omits secrets from backup fixtures", () => {
    const backup = buildBackup({
      tasks: [{ id: "task-1", title: "Study", api_token: "secret" }],
      push_subscriptions: [{ endpoint: "https://push.example" }],
      connections: [{ encrypted_credentials: "ciphertext" }],
    });

    expect(backup.data).toEqual({ tasks: [{ id: "task-1", title: "Study" }] });
  });
});
