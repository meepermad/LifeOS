import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertMicrosoftIntegrationEnabled,
  isMicrosoftIntegrationEnabled,
  MicrosoftIntegrationDisabledError,
} from "@/lib/integrations/microsoft/feature-flag";

describe("microsoft feature flag", () => {
  const originalValue = process.env.MICROSOFT_INTEGRATION_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.MICROSOFT_INTEGRATION_ENABLED;
    } else {
      process.env.MICROSOFT_INTEGRATION_ENABLED = originalValue;
    }
  });

  it("is disabled by default", () => {
    delete process.env.MICROSOFT_INTEGRATION_ENABLED;
    expect(isMicrosoftIntegrationEnabled()).toBe(false);
    expect(isMicrosoftIntegrationEnabled("false")).toBe(false);
    expect(isMicrosoftIntegrationEnabled("")).toBe(false);
  });

  it("enables only for explicit true values", () => {
    expect(isMicrosoftIntegrationEnabled("true")).toBe(true);
    expect(isMicrosoftIntegrationEnabled("TRUE")).toBe(true);
    expect(isMicrosoftIntegrationEnabled("1")).toBe(true);
    expect(isMicrosoftIntegrationEnabled("yes")).toBe(true);
    expect(isMicrosoftIntegrationEnabled("0")).toBe(false);
  });

  it("throws a safe error when asserting while disabled", () => {
    delete process.env.MICROSOFT_INTEGRATION_ENABLED;
    expect(() => assertMicrosoftIntegrationEnabled()).toThrow(
      MicrosoftIntegrationDisabledError,
    );
  });

  it("allows assert when enabled", () => {
    process.env.MICROSOFT_INTEGRATION_ENABLED = "true";
    expect(() => assertMicrosoftIntegrationEnabled()).not.toThrow();
  });
});

describe("getMicrosoftConfig when disabled", () => {
  const originalFlag = process.env.MICROSOFT_INTEGRATION_ENABLED;
  const originalClientId = process.env.MICROSOFT_CLIENT_ID;
  const originalClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const originalRedirectUri = process.env.MICROSOFT_REDIRECT_URI;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.MICROSOFT_INTEGRATION_ENABLED;
    } else {
      process.env.MICROSOFT_INTEGRATION_ENABLED = originalFlag;
    }

    if (originalClientId === undefined) {
      delete process.env.MICROSOFT_CLIENT_ID;
    } else {
      process.env.MICROSOFT_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.MICROSOFT_CLIENT_SECRET;
    } else {
      process.env.MICROSOFT_CLIENT_SECRET = originalClientSecret;
    }

    if (originalRedirectUri === undefined) {
      delete process.env.MICROSOFT_REDIRECT_URI;
    } else {
      process.env.MICROSOFT_REDIRECT_URI = originalRedirectUri;
    }

    vi.resetModules();
  });

  it("does not require Microsoft env vars when the flag is false", async () => {
    process.env.MICROSOFT_INTEGRATION_ENABLED = "false";
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.MICROSOFT_REDIRECT_URI;

    const { getMicrosoftConfig } = await import("@/lib/security/env");
    expect(() => getMicrosoftConfig()).toThrow(MicrosoftIntegrationDisabledError);
  });
});
