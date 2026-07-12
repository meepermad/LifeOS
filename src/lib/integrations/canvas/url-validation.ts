import { isIP } from "net";
import { ValidationError } from "@/lib/errors/app-error";
import { getCanvasAllowedHostnames } from "@/lib/security/env";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
]);

function isPrivateOrReservedIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedIpAddress(hostname: string): boolean {
  const version = isIP(hostname);
  if (version === 4) {
    const parts = hostname.split(".").map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) {
      return true;
    }
    return isPrivateOrReservedIpv4(parts);
  }

  if (version === 6) {
    const normalized = hostname.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
  }

  return false;
}

function assertHostnameAllowed(hostname: string): void {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(normalizedHost)) {
    throw new ValidationError("Canvas feed URL hostname is not allowed");
  }

  if (normalizedHost.endsWith(".localhost")) {
    throw new ValidationError("Canvas feed URL hostname is not allowed");
  }

  if (isBlockedIpAddress(normalizedHost)) {
    throw new ValidationError("Canvas feed URL must not target private networks");
  }

  const allowedHostnames = getCanvasAllowedHostnames();
  if (!allowedHostnames.includes(normalizedHost)) {
    throw new ValidationError("Canvas feed URL hostname is not in the allowlist");
  }
}

export function assertCanvasFeedUrlAllowed(url: URL): void {
  if (url.protocol !== "https:") {
    throw new ValidationError("Canvas feed URL must use HTTPS");
  }

  if (url.username || url.password) {
    throw new ValidationError("Canvas feed URL must not include embedded credentials");
  }

  if (!url.hostname) {
    throw new ValidationError("Canvas feed URL must include a hostname");
  }

  assertHostnameAllowed(url.hostname);
}

export function validateCanvasFeedUrl(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new ValidationError("Canvas feed URL must be a valid URL");
  }

  assertCanvasFeedUrlAllowed(parsed);
  return parsed;
}
