import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseIcsEvents } from "@/lib/integrations/canvas/ics-parser";
import { parseCanvasFeed } from "@/lib/integrations/canvas/parse-feed";

function loadFixture(name: string): string {
  return readFileSync(join(process.cwd(), "tests/fixtures/canvas", name), "utf8");
}

describe("ics parser", () => {
  it("parses vevent blocks from ics text", () => {
    const events = parseIcsEvents(loadFixture("timed-event.ics"));
    expect(events).toHaveLength(1);
    expect(events[0]?.uid).toBe("timed-event-1@lifeos.test");
    expect(events[0]?.summary).toBe("CS 510 Lecture");
  });

  it("parses full canvas feed fixtures end to end", () => {
    const parsed = parseCanvasFeed(loadFixture("duplicate-uid.ics"));
    expect(parsed.events).toHaveLength(1);
    expect(parsed.warnings).toBeGreaterThan(0);
  });
});
