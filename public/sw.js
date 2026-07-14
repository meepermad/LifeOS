const CACHE_NAME = "lifeos-shell-v2";
const SHELL_URLS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

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

const ALLOWED_ROUTES = ["/today", "/week", "/tasks", "/settings", "/status", "/work", "/calendar"];

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
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = sanitizeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
