const CACHE_NAME = 'mazeeda-tamrin-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Just a simple pass-through fetch handler to satisfy PWA requirements
  event.respondWith(fetch(event.request).catch(() => new Response('Offline')));
});
