import { describe, expect, it } from "vitest";
import { verifyCronSecret } from "@/lib/notifications/cron-auth";

describe("verifyCronSecret", () => {
  const secret = "test-cron-secret-value";

  it("rejects missing authorization", () => {
    expect(verifyCronSecret(null, secret)).toBe(false);
  });

  it("rejects incorrect secret", () => {
    expect(verifyCronSecret("Bearer wrong-secret", secret)).toBe(false);
  });

  it("accepts valid secret", () => {
    expect(verifyCronSecret(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("rejects different length without timing leak via exception", () => {
    expect(verifyCronSecret("Bearer short", secret)).toBe(false);
  });
});
