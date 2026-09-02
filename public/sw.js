// Offline app shell. Capture happens on the move, on the tube, in dead
// zones (build spec §12) - the app has to open and accept input with no
// connection at all. Captured data already lives in IndexedDB; this is
// what makes the shell around it reachable.

const VERSION = "v2";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

// Every route the tab bar can reach, so the whole app is navigable offline
// rather than just whichever page happened to be open.
const SHELL_ROUTES = [
  "/",
  "/tony",
  "/tony/new",
  "/tony/import",
  "/tony/claims",
  "/tony/cv-variants",
  "/lisa",
  "/vanessa",
  "/marco",
  "/settings",
];

const ASSET_PATTERN = /["'(](\/_next\/static\/[^"')\s]+)["')]/g;
const CSS_URL_PATTERN = /url\((["']?)(\/_next\/static\/[^"')]+)\1\)/g;

// Caching a route's HTML isn't enough on its own: a client-side navigation
// also needs that route's JavaScript chunk, and a chunk never fetched
// while online would be missing offline. The filenames are content-hashed
// and only known after a build, so they are read back out of the markup
// here rather than from a generated manifest - which keeps the service
// worker independent of how the host assembles its build output.
function collectFrom(text, pattern, group, into) {
  for (const match of text.matchAll(pattern)) into.add(match[group]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      const assets = await caches.open(ASSET_CACHE);
      const assetUrls = new Set();

      await Promise.allSettled(
        SHELL_ROUTES.map(async (route) => {
          const response = await fetch(route, { cache: "no-cache" });
          if (!response.ok) return;
          await shell.put(route, response.clone());
          collectFrom(await response.text(), ASSET_PATTERN, 1, assetUrls);
        }),
      );

      await Promise.allSettled([...assetUrls].map((url) => assets.add(url)));

      // Stylesheets reference fonts by their own hashed URLs, which never
      // appear in the HTML; without this pass the app would fall back to a
      // system font the first time it opens offline.
      const fontUrls = new Set();
      await Promise.allSettled(
        [...assetUrls]
          .filter((url) => url.endsWith(".css"))
          .map(async (url) => {
            const hit = await assets.match(url);
            if (hit) collectFrom(await hit.text(), CSS_URL_PATTERN, 2, fontUrls);
          }),
      );
      await Promise.allSettled([...fontUrls].map((url) => assets.add(url)));

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Build assets are content-hashed, so a cache hit can never be stale.
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// Network-first for pages, so a deploy is picked up as soon as there is a
// connection, and the cached shell only steps in when there isn't one.
async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (fallback) {
      const shell = await cache.match(fallback);
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch anything but same-origin GETs: the OpenRouter call must
  // fail honestly when offline rather than be served something stale.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/"));
    return;
  }

  event.respondWith(
    cacheFirst(request, ASSET_CACHE).catch(() => fetch(request)),
  );
});
