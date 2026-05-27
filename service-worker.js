/*
    LT: Service worker saugo app failus ir jau matytas žemėlapio plyteles.
    EN: The service worker caches app files and map tiles that have already been seen.
*/

const CACHE_NAME = "marine-navigator-map-cache-v1";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./media/icons/icon-192.png",
  "./media/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
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
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then(async (response) => {
          if (
            !response ||
            response.status === 206 ||
            (!response.ok && response.type !== "opaque")
          ) {
            return response;
          }

          const copy = response.clone();
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, copy);
          } catch (error) {
            // LT: Kai kurie cross-origin atsakymai negali būti cache'inami. / EN: Some cross-origin responses cannot be cached.
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("", { status: 504, statusText: "Offline" });
        });
    }),
  );
});
