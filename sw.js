const CACHE_NAME = 'satranc-ata-v20';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './css/auth.css',
  './js/app.js',
  './js/auth.js',
  './js/ai.js',
  './js/audio.js',
  './js/canvas.js',
  './js/engine.js',
  './js/socket.js',
  './manifest.json',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon.png',
  './assets/inventory_chest.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => cachedResponse);
    })
  );
});
