const CACHE_NAME = 'minds-myg-cache-v74';
const urlsToCache = [
'./',
'./index.html',
'./manifest.json',
'./frontend/css/style.css',
'./backend/config.js',
'./frontend/js/state.js',
'./frontend/js/api.js',
'./frontend/js/dnd.js',
'./frontend/js/ui.js',
'./frontend/js/auth.js',
'./frontend/js/pairing.js',
'./frontend/js/grouping.js',
'./frontend/js/comm.js',
'./frontend/js/volunteer.js',
'./frontend/js/settings.js',
'./frontend/js/main.js'
];

self.addEventListener('install', event => {
// Force the waiting service worker to become the active service worker
self.skipWaiting();
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => {
return cache.addAll(urlsToCache);
})
);
});

self.addEventListener('activate', event => {
const cacheWhitelist = [CACHE_NAME];
event.waitUntil(
caches.keys().then(cacheNames => {
return Promise.all(
cacheNames.map(cacheName => {
if (cacheWhitelist.indexOf(cacheName) === -1) {
return caches.delete(cacheName);
}
})
);
}).then(() => {
// Claim all clients immediately so the new SW takes over instantly
return self.clients.claim();
})
);
});

self.addEventListener('fetch', event => {
// Only handle GET requests for caching
if (event.request.method !== 'GET') return;

// Network-First Strategy: Fetch from network first, then fall back to cache if offline
event.respondWith(
fetch(event.request)
.then(networkResponse => {
// Clone the response because it can only be consumed once
const responseClone = networkResponse.clone();
caches.open(CACHE_NAME).then(cache => {
cache.put(event.request, responseClone);
});
return networkResponse;
})
.catch(() => {
// If network fetch fails (e.g., offline), try serving from cache
return caches.match(event.request);
})
);
});