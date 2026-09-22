// Bump this only when the offline shell itself changes. Online requests are
// always network-first, so application updates are not held by this cache.
const CACHE_NAME = "csat-clock-shell-v1";
const APP_SHELL = ["/", "/site.webmanifest", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
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
      if (response.ok && request.destination !== "document") {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
  );
});
