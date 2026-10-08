/**
 * Dugout Admin PWA - Service Worker
 * Provides offline caching, background asset updates, and dugout field resilience.
 */

const CACHE_NAME = 'dugout-admin-pwa-v2.2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './icon.jpeg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './src/app.js',
  './src/ui.js',
  './src/state.js',
  './src/rules.js',
  './src/solver.js',
  './src/constants.js',
  './src/auth.js',
  './src/auth-ui.js',
  './src/team-storage.js',
  './src/team-manager-ui.js',
  './src/sample-data.js',
  './src/firebase-config.js',
  './src/ui-format.js',
];

// External CDN dependencies to cache for offline usage
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800;900&display=swap',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js',
];

// Install: Cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pre-cache local assets
      await cache.addAll(PRECACHE_ASSETS);
      // Pre-cache external CDN scripts gracefully (don't fail install if offline)
      try {
        await Promise.all(
          EXTERNAL_ASSETS.map((url) =>
            fetch(url, { mode: 'cors' })
              .then((res) => {
                if (res.ok) return cache.put(url, res);
              })
              .catch(() => null)
          )
        );
      } catch (e) {
        console.warn('[SW] Non-critical external asset caching skipped:', e);
      }
    })
  );
  self.skipWaiting();
});

// Activate: Clean up outdated caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: Stale-while-revalidate for local assets; Network-first for dynamic data
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Ignore chrome-extension or non-http requests
  if (!url.protocol.startsWith('http')) return;

  // Firebase auth/token APIs and firestore endpoints: Network-first
  if (
    url.hostname.includes('googleapis.com') &&
    (url.pathname.includes('/identitytoolkit') || url.pathname.includes('/securetoken') || url.pathname.includes('/google.firestore'))
  ) {
    event.respondWith(
      fetch(req).catch(() => {
        // Return offline response for Firestore/Auth if network is unreachable
        return new Response(JSON.stringify({ offline: true, error: 'Network unavailable in dugout' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // App shell, local assets, scripts, stylesheets, and images: Stale-While-Revalidate
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting an HTML navigation, return cached index.html
          if (req.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
