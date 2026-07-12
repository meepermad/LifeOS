import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/errors/app-error";
import {
  assertCanvasFeedUrlAllowed,
  validateCanvasFeedUrl,
} from "@/lib/integrations/canvas/url-validation";

const TEST_HOST = "canvas.example.edu";

vi.mock("@/lib/security/env", () => ({
  getCanvasAllowedHostnames: () => [TEST_HOST],
}));

describe("canvas url validation", () => {
  it("accepts an allowlisted https feed url", () => {
    const url = validateCanvasFeedUrl(`https://${TEST_HOST}/feeds/calendars/1.ics`);
    expect(url.hostname).toBe(TEST_HOST);
  });

  it("rejects non-https urls", () => {
    expect(() =>
      validateCanvasFeedUrl(`http://${TEST_HOST}/feeds/calendars/1.ics`),
    ).toThrow(ValidationError);
  });

  it("rejects localhost destinations", () => {
    expect(() =>
      validateCanvasFeedUrl("https://localhost/feeds/calendars/1.ics"),
    ).toThrow(ValidationError);
  });

  it("rejects private network destinations", () => {
    expect(() =>
      validateCanvasFeedUrl("https://192.168.1.10/feeds/calendars/1.ics"),
    ).toThrow(ValidationError);
  });

  it("rejects embedded credentials", () => {
    expect(() =>
      validateCanvasFeedUrl(`https://user:pass@${TEST_HOST}/feeds/calendars/1.ics`),
    ).toThrow(ValidationError);
  });

  it("rejects hostnames outside the allowlist", () => {
    expect(() =>
      validateCanvasFeedUrl("https://evil.example.edu/feeds/calendars/1.ics"),
    ).toThrow(ValidationError);
  });

  it("validates redirect targets through assertCanvasFeedUrlAllowed", () => {
    expect(() =>
      assertCanvasFeedUrlAllowed(new URL(`https://${TEST_HOST}/redirect`)),
    ).not.toThrow();
    expect(() =>
      assertCanvasFeedUrlAllowed(new URL("https://127.0.0.1/redirect")),
    ).toThrow(ValidationError);
  });
});
