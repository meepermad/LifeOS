/** Client-safe VAPID key conversion (no server imports). */

const VAPID_URL_SAFE_BASE64_PATTERN = /^[A-Za-z0-9_-]+$/;
const MIN_VAPID_PUBLIC_KEY_BYTES = 65;

export class VapidKeyError extends Error {
  readonly reason: "empty" | "malformed" | "too_short";

  constructor(reason: "empty" | "malformed" | "too_short") {
    super("invalid vapid key");
    this.name = "VapidKeyError";
    this.reason = reason;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const trimmed = base64String.trim();
  if (!trimmed) {
    throw new VapidKeyError("empty");
  }

  if (!VAPID_URL_SAFE_BASE64_PATTERN.test(trimmed)) {
    throw new VapidKeyError("malformed");
  }

  const padding = "=".repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = (trimmed + padding).replace(/-/g, "+").replace(/_/g, "/");

  let rawData: string;
  try {
    rawData = atob(base64);
  } catch {
    throw new VapidKeyError("malformed");
  }

  if (rawData.length < MIN_VAPID_PUBLIC_KEY_BYTES) {
    throw new VapidKeyError("too_short");
  }

  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function decodeVapidPublicKey(base64String: string): Uint8Array {
  return urlBase64ToUint8Array(base64String);
}

export function isValidVapidPublicKey(base64String: string): boolean {
  try {
    urlBase64ToUint8Array(base64String);
    return true;
  } catch {
    return false;
  }
}
