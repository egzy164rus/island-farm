// Offline-first application shell for the installable PWA.
const CACHE = 'island-farm-pwa-v72';
const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL('index.html', SCOPE_URL).href;
const SHELL = [
  SCOPE_URL.href,
  INDEX_URL,
  new URL('manifest.webmanifest', SCOPE_URL).href,
  new URL('icon-192.png', SCOPE_URL).href,
  new URL('icon-512.png', SCOPE_URL).href,
  new URL('icon-maskable-512.png', SCOPE_URL).href,
  new URL('apple-touch-icon.png', SCOPE_URL).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('island-farm-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Leave other origins and paths outside this app untouched.
  if (url.origin !== SCOPE_URL.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
        }
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(request)) || (await cache.match(INDEX_URL)) || (await cache.match(SCOPE_URL.href));
      })
    );
    return;
  }

  // Cache-first for the app shell and same-origin static resources.
  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
        }
        return response;
      });
    })
  );
});
