/* Animedy service worker — offline app-shell caching.
 * API responses are POST-only and are NOT cached here; offline data
 * lives in the IndexedDB layer (T5.7). */
const CACHE_NAME = "animedy-shell-v1";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-maskable.svg"];

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
