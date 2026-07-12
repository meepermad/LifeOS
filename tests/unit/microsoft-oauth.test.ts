import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError, ValidationError } from "@/lib/errors/app-error";

vi.mock("@/lib/security/env", () => ({
  getMicrosoftConfig: vi.fn(() => ({
    clientId: "client-id",
    clientSecret: "client-secret",
    tenantId: "organizations",
    redirectUri: "http://localhost:3000/api/auth/microsoft/callback",
    authority: "https://login.microsoftonline.com/organizations",
  })),
  getTokenEncryptionKeyBytes: vi.fn(() => Buffer.alloc(32, 1)),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

import { cookies } from "next/headers";
import {
  hashAuthorizationCode,
  storeOAuthTransaction,
  validateOAuthTransaction,
} from "@/lib/integrations/microsoft/oauth";
import { MICROSOFT_OAUTH_TX_COOKIE } from "@/lib/integrations/microsoft/config";
import { encryptCredential } from "@/lib/security/credential-encryption";

describe("microsoft oauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing OAuth transaction", () => {
    expect(() => validateOAuthTransaction(null, "state")).toThrow(AuthenticationError);
  });

  it("rejects state mismatch", () => {
    expect(() =>
      validateOAuthTransaction(
        {
          state: "expected",
          nonce: "nonce",
          codeVerifier: "verifier",
          expiresAt: Date.now() + 60_000,
        },
        "wrong",
      ),
    ).toThrow(AuthenticationError);
  });

  it("rejects expired transaction", () => {
    expect(() =>
      validateOAuthTransaction(
        {
          state: "state",
          nonce: "nonce",
          codeVerifier: "verifier",
          expiresAt: Date.now() - 1,
        },
        "state",
      ),
    ).toThrow(AuthenticationError);
  });

  it("rejects consumed transaction replay", () => {
    expect(() =>
      validateOAuthTransaction(
        {
          state: "state",
          nonce: "nonce",
          codeVerifier: "verifier",
          expiresAt: Date.now() + 60_000,
          consumed: true,
        },
        "state",
      ),
    ).toThrow(AuthenticationError);
  });

  it("rejects missing PKCE verifier", () => {
    expect(() =>
      validateOAuthTransaction(
        {
          state: "state",
          nonce: "nonce",
          codeVerifier: "",
          expiresAt: Date.now() + 60_000,
        },
        "state",
      ),
    ).toThrow(ValidationError);
  });

  it("encrypts token cache before persistence", () => {
    const encrypted = encryptCredential('{"Account":{}}');
    expect(encrypted).not.toContain("Account");
    expect(encrypted.length).toBeGreaterThan(20);
  });

  it("detects authorization code replay", () => {
    const code = "auth-code-123";
    const hash = hashAuthorizationCode(code);
    expect(hash).toHaveLength(64);
    expect(hashAuthorizationCode(code)).toBe(hash);
  });

  it("sets secure OAuth transaction cookies in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const cookieStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);

    await storeOAuthTransaction({
      state: "state",
      nonce: "nonce",
      codeVerifier: "verifier",
    });

    expect(cookieStore.set).toHaveBeenCalledWith(
      MICROSOFT_OAUTH_TX_COOKIE,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      }),
    );

    vi.unstubAllEnvs();
  });
});
