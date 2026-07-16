import {
  ALLOWED_ROUTE_PREFIXES,
  resolveNotificationDestination,
  resolvePathFromPushData,
  sanitizeInternalReturnPath,
} from "@/lib/notifications/destination";

export type AllowedNotificationRoute = (typeof ALLOWED_ROUTE_PREFIXES)[number];

export function isAllowedNotificationRoute(url: string): boolean {
  if (typeof url !== "string") return false;
  return sanitizeInternalReturnPath(url) === url;
}

export function sanitizeNotificationUrl(url: string): string {
  return sanitizeInternalReturnPath(url);
}

export function containsSensitiveContent(text: string): boolean {
  const sensitivePatterns = [
    /@/,
    /canvas/i,
    /microsoft/i,
    /gmail/i,
    /meeting with/i,
    /class:/i,
    /course/i,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(text));
}

export {
  resolveNotificationDestination,
  resolvePathFromPushData,
  sanitizeInternalReturnPath,
};
