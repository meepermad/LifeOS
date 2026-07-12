export type PushSupportResult = {
  supported: boolean;
  reason?: string;
};

/**
 * Feature-detect Web Push without browser-name checks.
 * PushManager is not always exposed on `window` (e.g. some Chromium builds).
 */
export function detectBrowserPushSupport(): PushSupportResult {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { supported: false, reason: "Not running in a browser" };
  }

  if (!window.isSecureContext) {
    return {
      supported: false,
      reason:
        "Web Push requires a secure context (HTTPS or localhost). Do not open the app via a LAN IP or unencrypted hostname.",
    };
  }

  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "Service workers are not available" };
  }

  if (!("Notification" in window)) {
    return { supported: false, reason: "Notifications API is not available" };
  }

  const hasPushManager =
    "PushManager" in window ||
    "pushManager" in ServiceWorkerRegistration.prototype;

  if (!hasPushManager) {
    return { supported: false, reason: "Push API is not available" };
  }

  return { supported: true };
}

export function isBrowserPushSupported(): boolean {
  return detectBrowserPushSupport().supported;
}
