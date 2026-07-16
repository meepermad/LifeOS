/**
 * Dependency-free notification destination resolver for the service worker.
 * Keep in parity with src/lib/notifications/destination.ts
 */
(function (root) {
  "use strict";

  var MAX_INTERNAL_PATH_LENGTH = 512;
  var ALLOWED_ROUTE_PREFIXES = [
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
  ];

  var UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  var DAILY_STEPS = {
    timer: true,
    overdue: true,
    schedule: true,
    priorities: true,
    planning: true,
    overload: true,
    confirm: true,
    completed: true,
    unfinished: true,
    feedback: true,
    tomorrow: true,
    "planning-feedback": true,
  };

  var WEEKLY_STEPS = {
    timing: true,
    unfinished: true,
    inbox: true,
    waiting: true,
    work: true,
    school: true,
    deadlines: true,
    priorities: true,
    planning: true,
    confirm: true,
    capacity: true,
  };

  var TASK_VIEWS = {
    today: true,
    upcoming: true,
    overdue: true,
    waiting: true,
  };

  function isUuid(value) {
    return typeof value === "string" && UUID_RE.test(value);
  }

  function isLocalDate(value) {
    if (typeof value !== "string" || !LOCAL_DATE_RE.test(value)) return false;
    var parts = value.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    var dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }

  function hasControlChars(value) {
    for (var i = 0; i < value.length; i += 1) {
      var code = value.charCodeAt(i);
      if (code < 32 || code === 127) return true;
    }
    return false;
  }

  function pathPrefixAllowed(pathname) {
    for (var i = 0; i < ALLOWED_ROUTE_PREFIXES.length; i += 1) {
      var prefix = ALLOWED_ROUTE_PREFIXES[i];
      if (pathname === prefix || pathname.indexOf(prefix + "/") === 0) {
        return true;
      }
    }
    return false;
  }

  function sanitizeInternalReturnPath(path) {
    if (typeof path !== "string" || path.length === 0) return "/today";
    if (path.length > MAX_INTERNAL_PATH_LENGTH) return "/today";
    if (path.charAt(0) !== "/") return "/today";
    if (path.indexOf("//") === 0) return "/today";
    if (path.indexOf("://") !== -1) return "/today";
    if (
      path.indexOf("\\") !== -1 ||
      path.indexOf("%5c") !== -1 ||
      path.indexOf("%5C") !== -1
    ) {
      return "/today";
    }
    if (hasControlChars(path)) return "/today";

    var decoded = path;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return "/today";
    }
    if (decoded.indexOf("//") === 0 || decoded.indexOf("://") !== -1) {
      return "/today";
    }
    if (decoded.indexOf("\\") !== -1) return "/today";
    if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return "/today";

    var qIndex = path.indexOf("?");
    var hIndex = path.indexOf("#");
    var end = path.length;
    if (qIndex >= 0) end = Math.min(end, qIndex);
    if (hIndex >= 0) end = Math.min(end, hIndex);
    var pathname = path.slice(0, end) || "/";

    if (!pathPrefixAllowed(pathname)) return "/today";
    return path;
  }

  function appendQuery(base, params) {
    var parts = [];
    for (var key in params) {
      if (
        Object.prototype.hasOwnProperty.call(params, key) &&
        params[key] !== undefined &&
        params[key] !== ""
      ) {
        parts.push(
          encodeURIComponent(key) + "=" + encodeURIComponent(params[key]),
        );
      }
    }
    return parts.length ? base + "?" + parts.join("&") : base;
  }

  function resolveNotificationDestination(destination) {
    if (!destination || typeof destination !== "object") return "/today";
    var kind = destination.kind;
    if (typeof kind !== "string") return "/today";

    switch (kind) {
      case "today":
        return "/today";

      case "calendar_week": {
        var localDate = destination.localDate;
        if (localDate !== undefined && !isLocalDate(localDate)) return "/today";
        return appendQuery("/calendar", {
          view: "week",
          date: isLocalDate(localDate) ? localDate : undefined,
        });
      }

      case "daily_review": {
        var period = destination.period;
        if (period !== "morning" && period !== "evening") return "/today";
        var step = destination.step;
        if (step !== undefined && !DAILY_STEPS[step]) return "/today";
        return appendQuery("/review/daily", {
          period: period,
          step: step && DAILY_STEPS[step] ? step : undefined,
        });
      }

      case "weekly_review": {
        var weekStart = destination.weekStart;
        if (weekStart !== undefined && !isLocalDate(weekStart)) return "/today";
        var wStep = destination.step;
        if (wStep !== undefined && !WEEKLY_STEPS[wStep]) return "/today";
        return appendQuery("/review/weekly", {
          weekStart: isLocalDate(weekStart) ? weekStart : undefined,
          step: wStep && WEEKLY_STEPS[wStep] ? wStep : undefined,
        });
      }

      case "task": {
        var taskId = destination.taskId;
        var view = destination.view;
        if (taskId !== undefined && !isUuid(taskId)) return "/today";
        if (view !== undefined && !TASK_VIEWS[view]) return "/today";
        return appendQuery("/tasks", {
          view: view && TASK_VIEWS[view] ? view : undefined,
          focus: isUuid(taskId) ? taskId : undefined,
        });
      }

      case "planning_feedback": {
        var planningBlockId = destination.planningBlockId;
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
        var timeEntryId = destination.timeEntryId;
        if (timeEntryId !== undefined && !isUuid(timeEntryId)) return "/today";
        return appendQuery("/today", {
          panel: "active-timer",
          entry: isUuid(timeEntryId) ? timeEntryId : undefined,
        });
      }

      case "notification_settings":
        return "/settings?section=notifications";

      default:
        return "/today";
    }
  }

  function resolvePathFromPushData(data) {
    if (!data || typeof data !== "object") return "/today";

    if (data.destination && typeof data.destination === "object") {
      return sanitizeInternalReturnPath(
        resolveNotificationDestination(data.destination),
      );
    }

    if (typeof data.url === "string") {
      var url = data.url;
      var pathOnly = (url.split("?")[0] || url).split("#")[0] || url;
      if (pathOnly === "/settings" || pathOnly.indexOf("/settings/") === 0) {
        return sanitizeInternalReturnPath(
          url.indexOf("section=") !== -1
            ? url
            : "/settings?section=notifications",
        );
      }
      if (pathOnly === "/test") {
        return "/settings?section=notifications";
      }
      return sanitizeInternalReturnPath(url);
    }

    return "/today";
  }

  root.LifeOsNotificationDestinations = {
    MAX_INTERNAL_PATH_LENGTH: MAX_INTERNAL_PATH_LENGTH,
    ALLOWED_ROUTE_PREFIXES: ALLOWED_ROUTE_PREFIXES,
    sanitizeInternalReturnPath: sanitizeInternalReturnPath,
    resolveNotificationDestination: resolveNotificationDestination,
    resolvePathFromPushData: resolvePathFromPushData,
  };
})(typeof self !== "undefined" ? self : this);
