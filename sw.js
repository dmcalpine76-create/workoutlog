// Iron Log Service Worker
// Caches the app shell for fully offline use.
// Update CACHE_VERSION whenever you deploy a new version of the app
// so users get the latest files automatically.

const CACHE_VERSION = 'ironlog-v1';
const CACHE_NAME = `ironlog-cache-${CACHE_VERSION}`;

// Files to cache on install — the complete app shell
const APP_SHELL = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // External fonts and scripts are cached on first fetch (see below)
];

// External resources to cache (CDN fonts, xlsx library)
const EXTERNAL_CACHE = [
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,600&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ── INSTALL: cache app shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Iron Log: caching app shell');
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('ironlog-cache-') && key !== CACHE_NAME)
          .map(key => {
            console.log('Iron Log: deleting old cache', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For navigation requests (loading the app), always try network first
  // so you get the latest version, fall back to cache if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For external CDN resources (fonts, xlsx) — cache first, network fallback
  if (EXTERNAL_CACHE.some(u => event.request.url.startsWith(u.split('?')[0]))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // For Google Fonts CSS/woff2 files — cache first
  if (event.request.url.includes('fonts.gstatic.com') ||
      event.request.url.includes('fonts.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
