import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { parseCanvasFeed } from "@/lib/integrations/canvas/parse-feed";
import { normalizeCanvasEvent } from "@/lib/integrations/canvas/normalize";

function loadFixture(name: string): string {
  return readFileSync(join(process.cwd(), "tests/fixtures/canvas", name), "utf8");
}

describe("canvas parse and normalize", () => {
  it("parses a timed event with timezone", () => {
    const parsed = parseCanvasFeed(loadFixture("timed-event.ics"));
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.title).toBe("CS 510 Lecture");
    expect(parsed.events[0]?.eventType).toBe("class");
    expect(parsed.events[0]?.startAt).toMatch(/Z$/);
  });

  it("parses an all-day assignment deadline", () => {
    const parsed = parseCanvasFeed(loadFixture("all-day-deadline.ics"));
    expect(parsed.events[0]?.allDay).toBe(true);
    expect(parsed.events[0]?.eventType).toBe("deadline");
  });

  it("maps cancelled entries", () => {
    const parsed = parseCanvasFeed(loadFixture("cancelled-event.ics"));
    expect(parsed.events[0]?.status).toBe("cancelled");
  });

  it("keeps the newest duplicate uid", () => {
    const parsed = parseCanvasFeed(loadFixture("duplicate-uid.ics"));
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.title).toBe("Updated Duplicate Entry");
    expect(parsed.warnings).toBeGreaterThan(0);
  });

  it("skips malformed entries without rejecting the feed", () => {
    const parsed = parseCanvasFeed(loadFixture("malformed-entry.ics"));
    expect(parsed.events).toHaveLength(1);
    expect(parsed.warnings).toBeGreaterThan(0);
  });

  it("interprets floating times in America/Chicago", () => {
    const parsed = parseCanvasFeed(loadFixture("floating-time.ics"));
    expect(parsed.events[0]?.startAt).toBe("2026-07-17T20:30:00.000Z");
  });

  it("produces stable content hashes", () => {
    const first = parseCanvasFeed(loadFixture("updated-event.ics"));
    const second = parseCanvasFeed(loadFixture("updated-event.ics"));
    expect(first.events[0]?.contentHash).toBe(second.events[0]?.contentHash);
  });

  it("changes content hash when event data changes", () => {
    const parsed = parseCanvasFeed(loadFixture("updated-event.ics"));
    const event = parsed.events[0];
    expect(event).toBeTruthy();
    if (!event) return;

    const changed = normalizeCanvasEvent({
      uid: event.externalEventId,
      summary: "Changed title",
      dtstart: {
        name: "DTSTART",
        params: { TZID: "America/Chicago" },
        value: "20260716T140000",
      },
      dtend: {
        name: "DTEND",
        params: { TZID: "America/Chicago" },
        value: "20260716T153000",
      },
    });

    expect(changed?.contentHash).not.toBe(event.contentHash);
  });
});
