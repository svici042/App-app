/*
    LT: Service worker saugo app failus ir jau matytas žemėlapio plyteles.
    EN: The service worker caches app files and map tiles that have already been seen.
*/

const CACHE_NAME = "marine-navigator-map-cache-v3";
const RUNTIME_CACHE_NAME = "marine-navigator-runtime-cache-v2";
const RUNTIME_CACHE_MAX_ENTRIES = 250;
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./media/logo/LovLaus logo.png",
  "./media/icons/icon-192.png",
  "./media/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(APP_FILES.map((file) => new Request(file, { cache: "reload" }))),
      ),
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
            .filter((key) => ![CACHE_NAME, RUNTIME_CACHE_NAME].includes(key))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

async function trimRuntimeCache(cache) {
  const requests = await cache.keys();
  const removable = requests.filter(
    (request) => !APP_FILES.includes(new URL(request.url).pathname.replace(/^\//, "./")),
  );
  const overflow = removable.length - RUNTIME_CACHE_MAX_ENTRIES;
  if (overflow <= 0) return;

  await Promise.all(removable.slice(0, overflow).map((request) => cache.delete(request)));
}

async function cacheResponse(request, response) {
  if (
    !response ||
    response.status === 206 ||
    (!response.ok && response.type !== "opaque")
  ) {
    return;
  }

  try {
    const cache = await caches.open(RUNTIME_CACHE_NAME);
    await cache.put(request, response.clone());
    await trimRuntimeCache(cache);
  } catch (error) {
    // LT: Kai kurie cross-origin atsakymai negali būti cache'inami. / EN: Some cross-origin responses cannot be cached.
  }
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("text/html")) {
      const appCache = await caches.open(CACHE_NAME);
      await appCache.put("./index.html", response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match("./index.html");
    return cached || new Response("", { status: 504, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then(async (response) => {
          await cacheResponse(event.request, response);
          return response;
        })
        .catch(() => {
          return new Response("", { status: 504, statusText: "Offline" });
        });
    }),
  );
});
