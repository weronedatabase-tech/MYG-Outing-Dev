const CACHE_NAME = 'myg-outing-cache-v2';

self.addEventListener('install', event => {
    // Force the waiting service worker to become the active service worker immediately
    self.skipWaiting(); 
});

self.addEventListener('activate', event => {
    // Clean up old caches when the new version activates
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) 
    );
});

// Network-first strategy to ensure the newest code is fetched, falling back to cache if offline
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If network fetch succeeds, clone and store it in cache
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    // Only cache successful GET requests over http/https
                    if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
                        cache.put(event.request, responseClone);
                    }
                });
                return response;
            })
            .catch(() => {
                // If network fails (e.g. offline), try to serve the resource from cache
                return caches.match(event.request);
            })
    );
});