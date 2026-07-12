import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError, DatabaseError } from "@/lib/errors/app-error";

const { savePushSubscription, setNotificationsEnabled } = vi.hoisted(() => ({
  savePushSubscription: vi.fn(),
  setNotificationsEnabled: vi.fn(),
}));

vi.mock("@/lib/data/push-subscriptions", () => ({
  savePushSubscription,
  setNotificationsEnabled,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { enableNotificationsAction } from "@/lib/actions/notifications";

const validInput = {
  endpoint: "https://push.example.com/device",
  keys: { p256dh: "a".repeat(80), auth: "b".repeat(40) },
};

describe("enableNotificationsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNotificationsEnabled.mockResolvedValue(undefined);
  });

  it("returns structured 401 persistence failures", async () => {
    savePushSubscription.mockRejectedValue(
      new AuthenticationError(
        "Your authentication session expired. Sign in again.",
      ),
    );

    const result = await enableNotificationsAction(validInput);

    expect(result).toEqual({
      success: false,
      stage: "persist",
      error: "Your authentication session expired. Sign in again.",
      errorCode: "AUTHENTICATION_ERROR",
      httpStatus: 401,
    });
  });

  it("returns structured 500 persistence failures", async () => {
    savePushSubscription.mockRejectedValue(
      new DatabaseError("LifeOS could not save this device subscription."),
    );

    const result = await enableNotificationsAction(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.stage).toBe("persist");
      expect(result.httpStatus).toBe(500);
      expect(result.errorCode).toBe("DATABASE_ERROR");
    }
  });

  it("returns structured 400 validation failures", async () => {
    const result = await enableNotificationsAction({
      ...validInput,
      endpoint: "not-a-url",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.stage).toBe("validation");
      expect(result.httpStatus).toBe(400);
      expect(result.errorCode).toBe("VALIDATION_ERROR");
    }
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it("succeeds idempotently when persistence succeeds", async () => {
    savePushSubscription.mockResolvedValue({
      id: "device-1",
      deviceName: "iPhone PWA",
      isActive: true,
      lastSuccessfulPush: null,
      lastFailedPush: null,
      createdAt: "2026-07-11T00:00:00.000Z",
    });

    const first = await enableNotificationsAction(validInput);
    const second = await enableNotificationsAction(validInput);

    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: true });
    expect(savePushSubscription).toHaveBeenCalledTimes(2);
  });
});
