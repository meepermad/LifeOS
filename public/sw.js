const CACHE_NAME = "lifeos-shell-v1";
const SHELL_URLS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
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

const ALLOWED_ROUTES = ["/today", "/week", "/tasks", "/settings"];

function sanitizeUrl(url) {
  if (typeof url !== "string" || !url.startsWith("/")) return "/today";
  if (url.includes("://") || url.startsWith("//")) return "/today";
  const path = url.split("?")[0].split("#")[0];
  return ALLOWED_ROUTES.includes(path) ? path : "/today";
}

function parsePushPayload(event) {
  try {
    const data = event.data ? event.data.json() : null;
    if (!data || typeof data !== "object") return null;
    return {
      title: typeof data.title === "string" ? data.title : "LifeOS",
      body: typeof data.body === "string" ? data.body : "You have a new notification.",
      tag: typeof data.tag === "string" ? data.tag : "lifeos-notification",
      url: sanitizeUrl(data.url),
      badgeCount: typeof data.badgeCount === "number" ? data.badgeCount : undefined,
    };
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event) ?? {
    title: "LifeOS",
    body: "You have a new notification.",
    tag: "lifeos-fallback",
    url: "/today",
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = sanitizeUrl(event.notification.data?.url ?? "/today");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then((focused) => {
            if (focused && "navigate" in focused) {
              return focused.navigate(url);
            }
            return undefined;
          });
        }
      }
      return clients.openWindow(url);
    }),
  );
});
