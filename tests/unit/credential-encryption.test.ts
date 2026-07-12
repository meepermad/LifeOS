import { randomBytes } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError } from "@/lib/errors/app-error";

const TEST_KEY = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
const OTHER_KEY = Buffer.from(randomBytes(32)).toString("base64");

vi.mock("@/lib/security/env", () => ({
  getTokenEncryptionKeyBytes: vi.fn(),
}));

import { getTokenEncryptionKeyBytes } from "@/lib/security/env";
import {
  decryptCredential,
  encryptCredential,
} from "@/lib/security/credential-encryption";

describe("credential encryption", () => {
  beforeEach(() => {
    vi.mocked(getTokenEncryptionKeyBytes).mockReturnValue(
      Buffer.from(TEST_KEY, "base64"),
    );
  });

  it("encrypts and decrypts credentials", () => {
    const encrypted = encryptCredential("https://canvas.example.edu/secret-feed");
    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe("https://canvas.example.edu/secret-feed");
    expect(encrypted).not.toContain("secret-feed");
  });

  it("fails decryption with the wrong key", () => {
    const encrypted = encryptCredential("https://canvas.example.edu/secret-feed");
    vi.mocked(getTokenEncryptionKeyBytes).mockReturnValue(
      Buffer.from(OTHER_KEY, "base64"),
    );

    expect(() => decryptCredential(encrypted)).toThrow(ConfigurationError);
  });

  it("rejects invalid stored payloads", () => {
    expect(() => decryptCredential("not-valid")).toThrow(ConfigurationError);
  });
});
