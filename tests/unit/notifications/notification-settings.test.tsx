import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NotificationStatus } from "@/components/notifications/notification-status";

describe("NotificationStatus", () => {
  afterEach(() => {
    cleanup();
  });
  it("shows unsupported browser state", () => {
    render(
      <NotificationStatus
        mounted={true}
        isSupported={false}
        unsupportedReason="Service workers are not available"
        isStandalone={false}
        isIosBrowser={false}
        permission="unsupported"
        deviceSubscriptionState="unsupported"
        devices={[]}
      />,
    );
    expect(screen.getByText(/not supported/i)).toBeInTheDocument();
  });

  it("shows permission denied state", () => {
    render(
      <NotificationStatus
        mounted={true}
        isSupported={true}
        isStandalone={true}
        isIosBrowser={false}
        permission="denied"
        deviceSubscriptionState="not_subscribed"
        devices={[]}
      />,
    );
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
  });

  it("shows iPhone installation instructions", () => {
    render(
      <NotificationStatus
        mounted={true}
        isSupported={true}
        isStandalone={false}
        isIosBrowser={true}
        permission="default"
        deviceSubscriptionState="not_subscribed"
        devices={[]}
      />,
    );
    expect(screen.getByText(/Home Screen/i)).toBeInTheDocument();
  });

  it("shows enabled subscription state", () => {
    render(
      <NotificationStatus
        mounted={true}
        isSupported={true}
        isStandalone={true}
        isIosBrowser={false}
        permission="granted"
        deviceSubscriptionState="registered"
        devices={[
          {
            id: "d1",
            deviceName: "Desktop browser",
            isActive: true,
            lastSuccessfulPush: null,
            lastFailedPush: null,
            createdAt: "2026-07-11T00:00:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("This device")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText(/Desktop browser/)).toBeInTheDocument();
  });
});
