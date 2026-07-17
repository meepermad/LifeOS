/**
 * Typed notification destination contract and safe path resolution.
 * Mirrored by public/lifeos-notification-destinations.js for the service worker.
 * Keep both implementations in parity (see destination-parity tests).
 */

export const MAX_INTERNAL_PATH_LENGTH = 512;

export const ALLOWED_ROUTE_PREFIXES = [
  "/today",
  "/week",
  "/calendar",
  "/tasks",
  "/settings",
  "/status",
  "/work",
  "/school",
  "/chat",
  "/inbox",
  "/insights",
  "/imports",
  "/events",
  "/assistant",
  "/review/daily",
  "/review/weekly",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DAILY_STEPS = new Set([
  "timer",
  "overdue",
  "schedule",
  "priorities",
  "planning",
  "overload",
  "confirm",
  "completed",
  "unfinished",
  "feedback",
  "tomorrow",
  "planning-feedback",
]);

const WEEKLY_STEPS = new Set([
  "timing",
  "unfinished",
  "inbox",
  "waiting",
  "work",
  "school",
  "deadlines",
  "priorities",
  "planning",
  "confirm",
  "capacity",
]);

const TASK_VIEWS = new Set(["today", "upcoming", "overdue", "waiting"]);

export type NotificationDestination =
  | { kind: "today" }
  | { kind: "calendar_week"; localDate?: string }
  | {
      kind: "daily_review";
      period: "morning" | "evening";
      step?: string;
    }
  | {
      kind: "weekly_review";
      weekStart?: string;
      step?: string;
    }
  | {
      kind: "task";
      taskId?: string;
      view?: "today" | "upcoming" | "overdue" | "waiting";
    }
  | {
      kind: "planning_feedback";
      planningBlockId?: string;
    }
  | {
      kind: "active_timer";
      timeEntryId?: string;
    }
  | { kind: "notification_settings" };

export type LifeOsPushData = {
  version: 1;
  notificationType: string;
  destination: NotificationDestination;
  deliveryId?: string;
  title: string;
  body: string;
  tag?: string;
  /** Pre-resolved path for legacy service workers. */
  url: string;
  badgeCount?: number;
};

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function isLocalDate(value: string | undefined): value is string {
  if (typeof value !== "string" || !LOCAL_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function pathPrefixAllowed(pathname: string): boolean {
  return (ALLOWED_ROUTE_PREFIXES as readonly string[]).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Sanitize an internal return / navigation path.
 * Always returns a path beginning with `/`.
 */
export function sanitizeInternalReturnPath(path: string): string {
  if (typeof path !== "string" || path.length === 0) return "/today";
  if (path.length > MAX_INTERNAL_PATH_LENGTH) return "/today";
  if (!path.startsWith("/")) return "/today";
  if (path.startsWith("//")) return "/today";
  if (path.includes("://")) return "/today";
  if (path.includes("\\") || path.includes("%5c") || path.includes("%5C")) {
    return "/today";
  }
  if (hasControlChars(path)) return "/today";

  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return "/today";
  }
  if (decoded.startsWith("//") || decoded.includes("://")) return "/today";
  if (decoded.includes("\\")) return "/today";
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return "/today";

  const qIndex = path.indexOf("?");
  const hIndex = path.indexOf("#");
  let end = path.length;
  if (qIndex >= 0) end = Math.min(end, qIndex);
  if (hIndex >= 0) end = Math.min(end, hIndex);
  const pathname = path.slice(0, end) || "/";

  if (!pathPrefixAllowed(pathname)) return "/today";
  return path;
}

function appendQuery(
  base: string,
  params: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Resolve a typed destination to a safe internal path.
 */
export function resolveNotificationDestination(
  destination: NotificationDestination | null | undefined,
): string {
  if (!destination || typeof destination !== "object") {
    return "/today";
  }

  const kind = (destination as { kind?: unknown }).kind;
  if (typeof kind !== "string") return "/today";

  switch (kind) {
    case "today":
      return "/today";

    case "calendar_week": {
      const localDate = (destination as { localDate?: string }).localDate;
      if (localDate !== undefined && !isLocalDate(localDate)) return "/today";
      return appendQuery("/calendar", {
        view: "week",
        date: isLocalDate(localDate) ? localDate : undefined,
      });
    }

    case "daily_review": {
      const period = (destination as { period?: string }).period;
      if (period !== "morning" && period !== "evening") return "/today";
      const step = (destination as { step?: string }).step;
      if (step !== undefined && !DAILY_STEPS.has(step)) return "/today";
      return appendQuery("/review/daily", {
        period,
        step: step && DAILY_STEPS.has(step) ? step : undefined,
      });
    }

    case "weekly_review": {
      const weekStart = (destination as { weekStart?: string }).weekStart;
      if (weekStart !== undefined && !isLocalDate(weekStart)) return "/today";
      const step = (destination as { step?: string }).step;
      if (step !== undefined && !WEEKLY_STEPS.has(step)) return "/today";
      return appendQuery("/review/weekly", {
        weekStart: isLocalDate(weekStart) ? weekStart : undefined,
        step: step && WEEKLY_STEPS.has(step) ? step : undefined,
      });
    }

    case "task": {
      const taskId = (destination as { taskId?: string }).taskId;
      const view = (destination as { view?: string }).view;
      if (taskId !== undefined && !isUuid(taskId)) return "/today";
      if (view !== undefined && !TASK_VIEWS.has(view)) return "/today";
      return appendQuery("/tasks", {
        view: view && TASK_VIEWS.has(view) ? view : undefined,
        focus: isUuid(taskId) ? taskId : undefined,
      });
    }

    case "planning_feedback": {
      const planningBlockId = (destination as { planningBlockId?: string })
        .planningBlockId;
      if (planningBlockId !== undefined && !isUuid(planningBlockId)) {
        return "/today";
      }
      return appendQuery("/review/daily", {
        period: "evening",
        step: "planning-feedback",
        focus: isUuid(planningBlockId) ? planningBlockId : undefined,
      });
    }

    case "active_timer": {
      const timeEntryId = (destination as { timeEntryId?: string }).timeEntryId;
      if (timeEntryId !== undefined && !isUuid(timeEntryId)) return "/today";
      return appendQuery("/today", {
        panel: "active-timer",
        entry: isUuid(timeEntryId) ? timeEntryId : undefined,
      });
    }

    case "notification_settings":
      return "/settings/notifications";

    default:
      return "/today";
  }
}

/**
 * Resolve navigation path from push notification data (v1 or legacy).
 */
export function resolvePathFromPushData(
  data: Record<string, unknown> | null | undefined,
): string {
  if (!data || typeof data !== "object") return "/today";

  if (data.destination && typeof data.destination === "object") {
    const resolved = resolveNotificationDestination(
      data.destination as NotificationDestination,
    );
    return sanitizeInternalReturnPath(resolved);
  }

  if (typeof data.url === "string") {
    const url = data.url;
    const pathOnly = url.split("?")[0]?.split("#")[0] ?? url;
    if (pathOnly === "/settings") {
      if (url.includes("section=notifications") || url.includes("section=")) {
        // Legacy query deep links are resolved by the settings hub redirect.
        return sanitizeInternalReturnPath(url);
      }
      return "/settings/notifications";
    }
    if (pathOnly.startsWith("/settings/")) {
      return sanitizeInternalReturnPath(url);
    }
    if (pathOnly === "/test") {
      return "/settings/notifications";
    }
    return sanitizeInternalReturnPath(url);
  }

  return "/today";
}

export function destinationForNotificationType(
  notificationType: string,
  options?: {
    taskId?: string;
    planningBlockId?: string;
    timeEntryId?: string;
    taskView?: "today" | "upcoming" | "overdue" | "waiting";
    localDate?: string;
    weekStart?: string;
  },
): NotificationDestination {
  switch (notificationType) {
    case "daily_agenda":
      return { kind: "today" };
    case "weekly_summary":
      return {
        kind: "calendar_week",
        localDate: options?.localDate,
      };
    case "morning_review":
      return { kind: "daily_review", period: "morning" };
    case "evening_review":
      return { kind: "daily_review", period: "evening" };
    case "weekly_review":
      return {
        kind: "weekly_review",
        weekStart: options?.weekStart,
      };
    case "deadline_warning":
      return {
        kind: "task",
        taskId: options?.taskId,
        view: options?.taskView ?? "upcoming",
      };
    case "waiting_followup":
      return {
        kind: "task",
        taskId: options?.taskId,
        view: "waiting",
      };
    case "overdue_decision":
      return {
        kind: "task",
        taskId: options?.taskId,
        view: "overdue",
      };
    case "planning_feedback":
      return {
        kind: "planning_feedback",
        planningBlockId: options?.planningBlockId,
      };
    case "stale_timer":
      return {
        kind: "active_timer",
        timeEntryId: options?.timeEntryId,
      };
    case "overload_warning":
      return { kind: "weekly_review", step: "capacity" };
    case "test":
      return { kind: "notification_settings" };
    default:
      return { kind: "today" };
  }
}

export function withResolvedUrl<
  T extends {
    destination: NotificationDestination;
    notificationType: string;
  },
>(
  payload: T & {
    title: string;
    body: string;
    tag?: string;
    deliveryId?: string;
    badgeCount?: number;
  },
): LifeOsPushData {
  const url = resolveNotificationDestination(payload.destination);
  return {
    version: 1,
    notificationType: payload.notificationType,
    destination: payload.destination,
    deliveryId: payload.deliveryId,
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url,
    badgeCount: payload.badgeCount,
  };
}
