// DM Workout Tracker Service Worker
// Uses relative paths so it works correctly on GitHub Pages subdirectories
// Update CACHE_VERSION when deploying a new version

const CACHE_VERSION = 'ironlog-v6';
const CACHE_NAME = `ironlog-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const EXTERNAL_CACHE = [
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ── INSTALL ───────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: remove old caches ──────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('ironlog-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  // Navigation: network first, fall back to cached index
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // CDN fonts and xlsx: cache first
  const isCDN = EXTERNAL_CACHE.some(u => event.request.url.startsWith(u.split('?')[0]))
    || event.request.url.includes('fonts.gstatic.com')
    || event.request.url.includes('fonts.googleapis.com');

  if (isCDN) {
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
