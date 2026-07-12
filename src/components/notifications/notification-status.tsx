"use client";

import {
  deviceSubscriptionHint,
  deviceSubscriptionLabel,
  type DeviceSubscriptionState,
} from "@/lib/notifications/subscription-status";
import type { DeviceSummary } from "@/lib/notifications/schemas";

function permissionLabel(
  permission: NotificationPermission | "unsupported" | "checking",
): string {
  switch (permission) {
    case "granted":
      return "Granted";
    case "denied":
      return "Denied";
    case "default":
      return "Not requested";
    case "checking":
      return "Checking…";
    case "unsupported":
      return "Unavailable";
    default:
      return permission;
  }
}

export function NotificationStatus({
  mounted,
  isSupported,
  unsupportedReason,
  isStandalone,
  isIosBrowser,
  permission,
  deviceSubscriptionState,
  devices,
}: {
  mounted: boolean;
  isSupported: boolean;
  unsupportedReason?: string;
  isStandalone: boolean;
  isIosBrowser: boolean;
  permission: NotificationPermission | "unsupported" | "checking";
  deviceSubscriptionState: DeviceSubscriptionState;
  devices: DeviceSummary[];
}) {
  const deviceHint = deviceSubscriptionHint(deviceSubscriptionState);

  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-2">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Browser support</dt>
          <dd className="text-right text-foreground">
            {!mounted
              ? "Checking…"
              : isSupported
                ? "Supported"
                : "Not supported"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Installed app</dt>
          <dd className="text-right text-foreground">
            {isStandalone ? "Yes" : "No"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Permission</dt>
          <dd className="text-right text-foreground">
            {permissionLabel(permission)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">This device</dt>
          <dd className="text-right text-foreground">
            {mounted
              ? deviceSubscriptionLabel(deviceSubscriptionState)
              : "Checking…"}
          </dd>
        </div>
      </dl>

      {mounted && isIosBrowser && (
        <p className="rounded-lg border border-border/70 bg-surface/50 p-3 text-foreground/80">
          On iPhone, add LifeOS to your Home Screen first (Share → Add to Home
          Screen), then open the installed app to enable notifications.
        </p>
      )}

      {!mounted && (
        <p className="text-muted">Checking browser notification support…</p>
      )}

      {mounted && !isSupported && (
        <p className="text-muted">
          {unsupportedReason ??
            "Web Push is not available in this browser. Use a supported browser or install the PWA."}
        </p>
      )}

      {permission === "denied" && (
        <p className="text-muted">
          Notifications are blocked. Re-enable them in your browser or device
          settings, then return here.
        </p>
      )}

      {deviceHint && (
        <p className="rounded-lg border border-border/70 bg-surface/50 p-3 text-foreground/80">
          {deviceHint}
        </p>
      )}

      {devices.some((d) => d.isActive) && (
        <div>
          <p className="mb-2 text-muted">Saved devices</p>
          <ul className="space-y-1">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex justify-between gap-2 text-foreground/90"
              >
                <span>{device.deviceName ?? "Unknown device"}</span>
                <span className="text-muted">
                  {device.isActive ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
