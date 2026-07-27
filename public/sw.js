const CACHE = "bara-shell-v2";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("bara-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isPrivate(request, url) {
  return request.method !== "GET" ||
    request.credentials === "include" ||
    request.headers.has("authorization") ||
    request.headers.has("cookie") ||
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("room") ||
    url.searchParams.has("invite") ||
    url.searchParams.has("token");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    if (
      url.pathname !== "/" ||
      url.search ||
      request.headers.has("authorization") ||
      request.headers.has("cookie")
    ) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put("/", response.clone());
        return response;
      } catch {
        return await cache.match("/") || Response.error();
      }
    })());
    return;
  }

  if (isPrivate(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  const isPrecachedAsset = APP_SHELL.includes(url.pathname) && url.pathname !== "/";
  const isImmutableNextAsset = url.pathname.startsWith("/_next/static/");
  if (!isPrecachedAsset && !isImmutableNextAsset) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
