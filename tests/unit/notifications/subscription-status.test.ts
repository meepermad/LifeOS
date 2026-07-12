import { describe, expect, it } from "vitest";
import {
  canEnableForDeviceState,
  reconcileDeviceSubscriptionState,
} from "@/lib/notifications/subscription-status";

describe("current device subscription reconciliation", () => {
  it("marks unsupported browsers", () => {
    expect(
      reconcileDeviceSubscriptionState({
        supported: false,
        browserHasSubscription: false,
        endpointRegisteredInDb: false,
      }),
    ).toBe("unsupported");
  });

  it("reports not subscribed when the browser has no subscription", () => {
    expect(
      reconcileDeviceSubscriptionState({
        supported: true,
        browserHasSubscription: false,
        endpointRegisteredInDb: true,
      }),
    ).toBe("not_subscribed");
  });

  it("reports browser_only when the browser subscription is not saved", () => {
    expect(
      reconcileDeviceSubscriptionState({
        supported: true,
        browserHasSubscription: true,
        endpointRegisteredInDb: false,
      }),
    ).toBe("browser_only");
    expect(canEnableForDeviceState("browser_only")).toBe(true);
  });

  it("reports registered when browser and database both match", () => {
    expect(
      reconcileDeviceSubscriptionState({
        supported: true,
        browserHasSubscription: true,
        endpointRegisteredInDb: true,
      }),
    ).toBe("registered");
    expect(canEnableForDeviceState("registered")).toBe(false);
  });
});
