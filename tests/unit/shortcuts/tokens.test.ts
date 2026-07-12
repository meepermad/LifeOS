import { describe, expect, it } from "vitest";
import {
  generateShortcutToken,
  hashShortcutToken,
  redactAuthorizationHeader,
  verifyShortcutToken,
} from "@/lib/shortcuts/tokens";

describe("shortcut tokens", () => {
  it("generates high-entropy tokens with prefix", () => {
    const generated = generateShortcutToken();
    expect(generated.token.startsWith("los_")).toBe(true);
    expect(generated.tokenHash).toHaveLength(64);
    expect(generated.tokenPrefix.length).toBeGreaterThan(0);
  });

  it("verifies matching tokens with constant-time hash compare", () => {
    const generated = generateShortcutToken();
    expect(verifyShortcutToken(generated.token, generated.tokenHash)).toBe(true);
    expect(verifyShortcutToken("los_invalid", generated.tokenHash)).toBe(false);
  });

  it("hashes tokens deterministically", () => {
    const token = "los_testtoken";
    expect(hashShortcutToken(token)).toBe(hashShortcutToken(token));
  });

  it("redacts authorization headers in logs", () => {
    const redacted = redactAuthorizationHeader({
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    });
    expect(redacted.Authorization).toBe("Bearer [REDACTED]");
    expect(redacted["Content-Type"]).toBe("application/json");
  });
});
