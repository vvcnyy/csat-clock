// Bump this only when the offline shell itself changes. Online requests are
// always network-first, so application updates are not held by this cache.
const CACHE_NAME = "csat-clock-shell-v2";
const APP_SHELL = ["/", "/site.webmanifest", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("csat-clock-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // Keep exam audio and API responses fresh; the app shell can fall back offline.
  if (new URL(request.url).pathname.startsWith("/api/") || new URL(request.url).pathname.startsWith("/sound/")) return;
  event.respondWith(
    fetch(request, { cache: "no-cache" }).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME)
          .then((cache) => cache.put(request.mode === "navigate" ? "/" : request, copy))
          .catch(() => undefined));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      // Never return HTML as a missing script, stylesheet or other asset.
      if (request.mode === "navigate") return (await caches.match("/")) || Response.error();
      return Response.error();
    }),
  );
});
