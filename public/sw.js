// Service Worker for Task Assigner PWA
const CACHE_NAME = 'task-assigner-v4';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
];

// Install event
self.addEventListener('install', (event) => {
  // Skip waiting to activate new service worker immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// A message arriving from the server while the app is closed. This is the whole
// point of the notification work: without it the owner only learns something is
// wrong by choosing to look, which is the habit the product exists to replace.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    // Never drop a notification because the body was malformed - something is
    // wrong at the restaurant either way.
    payload = {};
  }

  const title = payload.title || 'Task Assigner';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Something needs your attention.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      // Collapses repeats into one line rather than stacking a pile of alerts.
      tag: 'needs-attention',
      renotify: true,
      data: { url: payload.url || '/dashboard' },
    })
  );
});

// Tapping the notification should land on the problem, and should reuse an open
// tab rather than opening a fifth copy of the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  // Take control of all clients immediately
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
