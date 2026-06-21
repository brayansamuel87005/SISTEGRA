// ============================================================
// VENTO POS — Service worker (offline cache, app-shell strategy)
// ============================================================
const CACHE_NAME = 'vento-pos-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './pos.css',
  './manage.css',
  './icons.js',
  './db.js',
  './utils.js',
  './ui.js',
  './view-login.js',
  './view-pos.js',
  './view-inventory.js',
  './view-customers.js',
  './view-shift.js',
  './view-reports.js',
  './view-users.js',
  './view-settings.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// App-shell strategy: serve from cache first (fast, works offline),
// fall back to network, and update the cache in the background.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
