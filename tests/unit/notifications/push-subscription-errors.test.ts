import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ValidationError,
} from "@/lib/errors/app-error";
import {
  appErrorToHttpStatus,
  mapPushSubscriptionRpcError,
} from "@/lib/notifications/push-subscription-errors";

describe("push subscription persistence errors", () => {
  it("maps permission denied to a safe save failure message", () => {
    const error = mapPushSubscriptionRpcError({
      code: "42501",
      message: "permission denied for table push_subscriptions",
    });

    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.message).toBe(
      "LifeOS could not save this device subscription.",
    );
    expect(appErrorToHttpStatus(error)).toBe(500);
  });

  it("maps not authenticated to a session expiry message", () => {
    const error = mapPushSubscriptionRpcError({
      code: "42501",
      message: "Not authenticated",
    });

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe(
      "Your authentication session expired. Sign in again.",
    );
    expect(appErrorToHttpStatus(error)).toBe(401);
  });

  it("maps endpoint ownership conflicts to authorization errors", () => {
    const error = mapPushSubscriptionRpcError({
      code: "42501",
      message: "Subscription endpoint is registered to another account",
    });

    expect(error).toBeInstanceOf(AuthorizationError);
    expect(appErrorToHttpStatus(error)).toBe(403);
  });

  it("maps validation failures to safe messages", () => {
    const error = mapPushSubscriptionRpcError({
      code: "22023",
      message: "Invalid endpoint",
    });

    expect(error).toBeInstanceOf(ValidationError);
    expect(appErrorToHttpStatus(error)).toBe(400);
  });

  it("redacts sensitive values from database messages", () => {
    const error = mapPushSubscriptionRpcError({
      code: "XX000",
      message: "failed for https://push.example.com/x Bearer secret",
    });

    expect(error.message).not.toContain("https://push.example.com");
    expect(error.message).not.toContain("secret");
  });
});
