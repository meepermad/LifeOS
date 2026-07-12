const ALLOWED_NOTIFICATION_ROUTES = [
  "/today",
  "/week",
  "/tasks",
  "/settings",
  "/chat",
] as const;

export type AllowedNotificationRoute =
  (typeof ALLOWED_NOTIFICATION_ROUTES)[number];

export function isAllowedNotificationRoute(
  url: string,
): url is AllowedNotificationRoute {
  if (!url.startsWith("/")) return false;
  if (url.includes("://") || url.startsWith("//")) return false;
  const path = url.split("?")[0]?.split("#")[0] ?? url;
  if (path === "/chat") return true;
  return (ALLOWED_NOTIFICATION_ROUTES as readonly string[]).includes(path);
}

export function sanitizeNotificationUrl(url: string): AllowedNotificationRoute {
  if (isAllowedNotificationRoute(url)) {
    return url;
  }
  return "/today";
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
