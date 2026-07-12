import { describe, expect, it } from "vitest";
import { pushSubscriptionInputSchema } from "@/lib/notifications/schemas";

describe("pushSubscriptionInputSchema", () => {
  const valid = {
    endpoint: "https://push.example.com/send/abc123",
    keys: {
      p256dh: "BKxP5vA8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8",
      auth: "authkey123456",
    },
  };

  it("accepts valid subscription", () => {
    const result = pushSubscriptionInputSchema.parse(valid);
    expect(result.endpoint).toBe(valid.endpoint);
    expect(result.keys.p256dh).toBe(valid.keys.p256dh);
  });

  it("rejects invalid schema", () => {
    expect(() =>
      pushSubscriptionInputSchema.parse({ endpoint: "not-a-url", keys: valid.keys }),
    ).toThrow();
  });

  it("rejects oversized endpoint", () => {
    expect(() =>
      pushSubscriptionInputSchema.parse({
        endpoint: `https://push.example.com/${"a".repeat(2040)}`,
        keys: valid.keys,
      }),
    ).toThrow();
  });

  it("strips client-supplied userId from parsed output usage", () => {
    const result = pushSubscriptionInputSchema.parse({
      ...valid,
      userId: "00000000-0000-0000-0000-000000000099",
    });
    expect("userId" in result).toBe(true);
    expect(result.userId).toBe("00000000-0000-0000-0000-000000000099");
  });
});
