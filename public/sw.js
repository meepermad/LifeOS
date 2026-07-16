const CACHE_NAME = "lifeos-shell-v3";
const SHELL_URLS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

importScripts("/lifeos-notification-destinations.js");

var Dest = self.LifeOsNotificationDestinations;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  // Do not skipWaiting immediately — client confirms update via postMessage.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
  }
});

function logClickDiag(fields) {
  try {
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[lifeos-sw-notification]", fields);
    }
  } catch {
    // ignore
  }
}

function parsePushPayload(event) {
  try {
    const data = event.data ? event.data.json() : null;
    if (!data || typeof data !== "object") return null;
    const path = Dest.resolvePathFromPushData(data);
    return {
      title: typeof data.title === "string" ? data.title : "LifeOS",
      body:
        typeof data.body === "string"
          ? data.body
          : "You have a new notification.",
      tag: typeof data.tag === "string" ? data.tag : "lifeos-notification",
      notificationType:
        typeof data.notificationType === "string"
          ? data.notificationType
          : undefined,
      destination: data.destination,
      url: path,
      legacy: !data.destination,
      badgeCount:
        typeof data.badgeCount === "number" ? data.badgeCount : undefined,
    };
  } catch {
    return null;
  }
}

function toAbsoluteUrl(path) {
  try {
    return new URL(path, self.location.origin).href;
  } catch {
    return new URL("/today", self.location.origin).href;
  }
}

function openOrFocusClient(absoluteUrl, path, meta) {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      const sameOrigin = clientList.filter((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      const preferred =
        sameOrigin.find((c) => c.focused) ||
        sameOrigin.find((c) => c.visibilityState === "visible") ||
        sameOrigin[0];

      if (preferred) {
        logClickDiag({
          ...meta,
          existingClientFound: true,
        });
        const navigatePromise =
          typeof preferred.navigate === "function"
            ? preferred.navigate(absoluteUrl)
            : Promise.reject(new Error("navigate unsupported"));

        return navigatePromise
          .then((navigated) => {
            logClickDiag({
              ...meta,
              existingClientFound: true,
              navigateSucceeded: true,
            });
            if (navigated && "focus" in navigated) {
              return navigated.focus();
            }
            if ("focus" in preferred) {
              return preferred.focus();
            }
            return preferred;
          })
          .catch(() => {
            if (typeof preferred.postMessage === "function") {
              preferred.postMessage({
                type: "LIFEOS_NOTIFICATION_NAVIGATE",
                path: path,
              });
            }
            logClickDiag({
              ...meta,
              existingClientFound: true,
              navigateSucceeded: false,
              openWindowFallbackUsed: true,
            });
            if (self.clients.openWindow) {
              return self.clients.openWindow(absoluteUrl);
            }
            if ("focus" in preferred) {
              return preferred.focus();
            }
            return preferred;
          });
      }

      logClickDiag({
        ...meta,
        existingClientFound: false,
        openWindowFallbackUsed: true,
      });
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }
      return undefined;
    });
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event) ?? {
    title: "LifeOS",
    body: "You have a new notification.",
    tag: "lifeos-fallback",
    url: "/today",
    legacy: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: {
        version: 1,
        notificationType: payload.notificationType,
        destination: payload.destination,
        url: payload.url,
        legacy: payload.legacy,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const path = Dest.resolvePathFromPushData(data);
  const absoluteUrl = toAbsoluteUrl(path);
  const meta = {
    notificationType: data.notificationType,
    destinationKind:
      data.destination && typeof data.destination === "object"
        ? data.destination.kind
        : undefined,
    legacyPayload: Boolean(data.legacy) || !data.destination,
    destinationValidationFailed: path === "/today" && Boolean(data.destination),
  };

  event.waitUntil(openOrFocusClient(absoluteUrl, path, meta));
});
