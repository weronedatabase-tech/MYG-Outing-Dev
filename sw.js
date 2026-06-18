const CACHE_NAME = 'minds-myg-cache-v17';
const urlsToCache = [
'./',
'./index.html',
'./manifest.json',
'./frontend/css/style.css',
'./backend/config.js',
'./frontend/js/state.js',
'./frontend/js/api.js',
'./frontend/js/ui.js',
'./frontend/js/auth.js',
'./frontend/js/comm.js',
'./frontend/js/volunteer.js',
'./frontend/js/settings.js',
'./frontend/js/main.js'
];

self.addEventListener('install', event => {
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => {
 return cache.addAll(urlsToCache);
})
);
});

self.addEventListener('fetch', event => {
event.respondWith(
caches.match(event.request)
.then(response => {
 if (response) {
   return response;
 }
 return fetch(event.request);
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
})
);
});