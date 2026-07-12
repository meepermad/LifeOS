import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError } from "@/lib/errors/app-error";

const TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");

vi.mock("@/lib/security/env", () => ({
  getTokenEncryptionKeyBytes: vi.fn(() => Buffer.from(TOKEN_KEY, "base64")),
  getMicrosoftConfig: vi.fn(),
}));

import {
  deserializeTokenCache,
  serializeTokenCache,
} from "@/lib/integrations/microsoft/token-cache";
import { getTokenEncryptionKeyBytes } from "@/lib/security/env";

describe("microsoft token cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("round-trips serialize, encrypt, decrypt, deserialize", () => {
    const cacheJson = JSON.stringify({ Account: {}, AccessToken: {} });
    const encrypted = serializeTokenCache(cacheJson);
    const restored = deserializeTokenCache(encrypted);
    expect(restored).toBe(cacheJson);
  });

  it("fails safely with wrong encryption key", () => {
    const encrypted = serializeTokenCache("{}");
    vi.mocked(getTokenEncryptionKeyBytes).mockReturnValueOnce(Buffer.alloc(32, 9));
    expect(() => deserializeTokenCache(encrypted)).toThrow(ConfigurationError);
  });
});
