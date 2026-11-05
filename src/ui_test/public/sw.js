/* Animedy service worker — offline app-shell caching.
 * API responses are POST-only and are NOT cached here; offline data
 * lives in the IndexedDB layer (T5.7). */
const CACHE_NAME = "animedy-shell-v2";
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/tab-icon.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith("/api") || url.pathname.startsWith("/docs");
  if (request.method === "GET" && url.origin === self.location.origin && !isApi) {
    if (request.mode === "navigate") {
      // Network-first for navigations, fall back to cached shell when offline.
      event.respondWith(
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
            return response;
          })
          .catch(() => caches.match("/"))
      );
    } else {
      // Cache-first for static assets.
      event.respondWith(
        caches.match(request).then(
          (cached) =>
            cached ??
            fetch(request).then((response) => {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
              return response;
            })
        )
      );
    }
  }
});

/* --- Web Push: announcements + admin alerts ---
 * Pushes arrive payload-less (the server only sends a VAPID-authenticated
 * wake-up), so the worker asks the API what happened: a fresh announcement
 * (last 5 min) shows its own title/body and opens the app; otherwise it's an
 * admin alert (password reset request) and opens the admin dashboard. */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "Animedy Admin";
      let body = "New activity — open the admin dashboard to review it.";
      let url = "/#/admin";
      let matchedAnnouncement = false;
      try {
        const res = await fetch("/api/announcements/latest", { cache: "no-store" });
        const json = await res.json();
        const a = json && json.data && json.data.announcement;
        if (a && a.created_at) {
          const at = Date.parse(a.created_at.includes("T") ? a.created_at : a.created_at.replace(" ", "T") + "Z");
          if (Date.now() - at < 5 * 60 * 1000) {
            title = a.title;
            body = a.body;
            url = "/";
            matchedAnnouncement = true;
          }
        }
      } catch (_) {
        // offline or API hiccup — fall through to the generic admin alert
      }
      if (!matchedAnnouncement) {
        // Admin-only wake-up: ask what kind of event it was (type only).
        try {
          const res = await fetch("/api/push/event", { cache: "no-store" });
          const json = await res.json();
          const type = json && json.data && json.data.type;
          if (type === "feedback") {
            body = "New feedback received — open the admin dashboard to read it.";
          } else if (type === "reset") {
            body = "New password reset request — open the admin dashboard to review it.";
          }
        } catch (_) {
          // keep the generic text
        }
      }
      return self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "animedy-push",
        data: { url }
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/#/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
